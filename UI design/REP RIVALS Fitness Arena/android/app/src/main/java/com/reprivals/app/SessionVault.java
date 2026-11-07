package com.reprivals.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.MessageDigest;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** AndroidKeyStore keeps the AES key non-exportable. Preferences contain IV and ciphertext. */
final class SessionVault {
    private static final String ALIAS = "rep_rivals.session.v1";
    private final SharedPreferences prefs;
    private final byte[] audience;
    private final String slot;

    SessionVault(Context context, String origin) throws GeneralSecurityException {
        prefs = context.getSharedPreferences("rep_rivals_session", Context.MODE_PRIVATE);
        audience = origin.getBytes(StandardCharsets.UTF_8);
        slot = Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(audience), Base64.NO_WRAP);
    }

    private SecretKey key() throws GeneralSecurityException, IOException {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        SecretKey existing = (SecretKey) store.getKey(ALIAS, null);
        if (existing != null) return existing;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }

    void save(String token) throws GeneralSecurityException, IOException {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        cipher.updateAAD(audience);
        String encoded = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." +
            Base64.encodeToString(cipher.doFinal(token.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
        if (!prefs.edit().putString(slot, encoded).commit()) throw new IOException("Session storage failed");
    }

    String read() throws GeneralSecurityException, IOException {
        String encoded = prefs.getString(slot, null);
        if (encoded == null) return null;
        try {
            String[] parts = encoded.split("\\.", -1);
            if (parts.length != 2) throw new IllegalArgumentException();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            cipher.updateAAD(audience);
            return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException invalid) {
            clear();
            return null;
        }
    }

    void clear() throws IOException {
        if (!prefs.edit().remove(slot).commit()) throw new IOException("Session storage failed");
    }
}
