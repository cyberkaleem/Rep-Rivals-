package com.reprivals.app;

import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import okhttp3.CookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.json.JSONObject;

@CapacitorPlugin(name = "RepRivalsAccount")
public class AccountPlugin extends Plugin {
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    // Serialize credential replacement and revocation across Activity recreation.
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor();
    private static final OkHttpClient HTTP = new OkHttpClient.Builder()
        .cookieJar(CookieJar.NO_COOKIES).followRedirects(false).followSslRedirects(false)
        .retryOnConnectionFailure(false).callTimeout(25, TimeUnit.SECONDS).build();

    @PluginMethod
    public void request(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String url = getBridge().getWebView().getUrl();
            Uri page = url == null ? Uri.EMPTY : Uri.parse(url);
            if (!"https".equals(page.getScheme()) || !"localhost".equals(page.getAuthority())) {
                call.reject("Account access is unavailable on this page.");
                return;
            }
            WORKER.execute(() -> perform(call));
        });
    }

    private void perform(PluginCall call) {
        String origin = getContext().getString(R.string.account_api_origin);
        if (origin.isEmpty()) { finish(call, 503, null); return; }
        String operation = call.getString("operation", "");
        boolean issuing = operation.equals("login") || operation.equals("register");
        boolean logout = operation.equals("logout");
        boolean ticket = operation.equals("ticket");
        if (!issuing && !logout && !ticket && !operation.equals("me")) { finish(call, 400, null); return; }
        try {
            SessionVault vault = new SessionVault(getContext(), origin);
            String token = issuing ? null : vault.read();
            if (!issuing && token == null) { finish(call, logout ? 204 : 401, null); return; }
            JSONObject body = new JSONObject();
            if (issuing) {
                body.put("email", call.getString("email"));
                body.put("password", call.getString("password"));
                if (operation.equals("register")) body.put("username", call.getString("username"));
            }
            try (Response response = send(origin, operation, body, token)) {
                int status = response.code();
                if (!response.isSuccessful()) {
                    if (!issuing && status == 401) vault.clear();
                    finish(call, status, null);
                    return;
                }
                if (logout) {
                    if (status != 204) throw new IOException();
                    vault.clear();
                    finish(call, status, null);
                    return;
                }
                ResponseBody data = response.body();
                if (data == null || data.source().request(16385)) throw new IOException();
                JSONObject result = new JSONObject(data.string());
                if (ticket) {
                    String key = result.getString("ticket");
                    if (!key.matches("[A-Za-z0-9_-]{43}")) throw new IOException();
                    JSObject grant = new JSObject();
                    grant.put("ticket", key);
                    grant.put("origin", origin);
                    grant.put("status", status);
                    call.resolve(grant);
                    return;
                }
                JSONObject user = result.getJSONObject("user");
                JSObject publicUser = new JSObject();
                for (String field : new String[]{"id", "username", "email", "createdAt"}) {
                    publicUser.put(field, user.getString(field));
                }
                if (issuing) {
                    String fresh = result.getString("token");
                    if (!fresh.matches("rrn1\\.[A-Za-z0-9_-]{43}")) throw new IOException();
                    try { vault.save(fresh); }
                    catch (Exception storageFailure) {
                        try (Response ignored = send(origin, "logout", new JSONObject(), fresh)) {}
                        throw storageFailure;
                    }
                }
                finish(call, status, publicUser);
            }
        } catch (Exception failure) {
            // Never pass network exceptions, server bodies, credentials or request options to JS/logs.
            finish(call, 503, null);
        }
    }

    private static Response send(String origin, String operation, JSONObject body, String token) throws IOException {
        Request.Builder req = new Request.Builder().url(origin + "/api/auth/native/" + operation)
            .header("Accept", "application/json").header("Cache-Control", "no-store");
        if (token != null) req.header("Authorization", "Bearer " + token);
        if (!operation.equals("me")) req.post(RequestBody.create(body.toString(), JSON));
        return HTTP.newCall(req.build()).execute();
    }

    private static void finish(PluginCall call, int status, JSObject user) {
        JSObject result = new JSObject();
        result.put("status", status);
        if (user != null) result.put("user", user);
        call.resolve(result);
    }
}
