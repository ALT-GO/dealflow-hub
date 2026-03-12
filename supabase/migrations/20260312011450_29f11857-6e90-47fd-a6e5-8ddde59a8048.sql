ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS target_delivery_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';