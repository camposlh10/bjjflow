-- One invoice per payment plan per due date (NULL plan ids stay unrestricted,
-- so ad-hoc manual invoices are unaffected).
CREATE UNIQUE INDEX uq_invoices_plan_due_date ON invoices (payment_plan_id, due_date);

-- Supports the recurring invoice generator scanning active plans that are due.
CREATE INDEX idx_payment_plans_gym_active_due ON payment_plans (gym_id, active, next_due_date);
