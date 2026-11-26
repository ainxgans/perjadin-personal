-- Performance indexes for frequent workspace, trip, and expense queries
CREATE INDEX IF NOT EXISTS idx_trips_workspace_tanggal ON trips(workspace_id, tanggal_mulai DESC);
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method_id ON expenses(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
