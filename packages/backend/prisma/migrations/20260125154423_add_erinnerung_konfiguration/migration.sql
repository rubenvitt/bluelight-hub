-- CreateTable
CREATE TABLE "erinnerung_konfiguration" (
    "id" TEXT NOT NULL,
    "eskalations_timeout_seconds" INTEGER NOT NULL DEFAULT 300,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erinnerung_konfiguration_pkey" PRIMARY KEY ("id")
);
