BEGIN;

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" VARCHAR(24) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_username_format" CHECK ("username" ~ '^[a-z0-9_]{3,24}$'),
    CONSTRAINT "users_email_normalized" CHECK ("email" = lower(btrim("email")))
);

-- CreateTable
CREATE TABLE "authentication_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "authentication_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_sessions_digest_format" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "auth_sessions_valid_expiry" CHECK ("expires_at" > "created_at")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "authentication_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_idx" ON "authentication_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_expiry_idx" ON "authentication_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "authentication_sessions" ADD CONSTRAINT "auth_sessions_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
