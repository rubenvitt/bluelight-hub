-- CreateIndex
CREATE INDEX "idx_outbox_aggregate_id" ON "outbox_events"("aggregateId");
