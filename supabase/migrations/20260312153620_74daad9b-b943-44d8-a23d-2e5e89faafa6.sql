
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS carbono_zero boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cortex boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS endereco_execucao text,
  ADD COLUMN IF NOT EXISTS estudo_equipe text,
  ADD COLUMN IF NOT EXISTS tipo_negocio text,
  ADD COLUMN IF NOT EXISTS vendedor_externo text,
  ADD COLUMN IF NOT EXISTS comissao_carbono_zero numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_cortex numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_valor_venda numeric DEFAULT 0;
