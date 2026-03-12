
-- Drop the old check constraint that restricts stage values
ALTER TABLE deals DROP CONSTRAINT deals_stage_check;

-- Update existing funnel stage keys to match external system internal names
UPDATE funnel_stages SET key = 'appointmentscheduled' WHERE id = '8256dcad-8f9e-4103-81a8-b97c00f6a120';
UPDATE funnel_stages SET key = 'qualifiedtobuy' WHERE id = 'a2c9ba42-b408-45e4-9052-f78338103e93';
UPDATE funnel_stages SET key = '1028864401' WHERE id = 'c7d11ba0-245a-4aea-af3e-d61908379c5b';
UPDATE funnel_stages SET key = 'presentationscheduled', label = 'Elaboração de Proposta' WHERE id = 'f10cd122-7850-4811-9415-bdb40fa780f2';
UPDATE funnel_stages SET key = 'decisionmakerboughtin' WHERE id = '993b08ee-0986-40c9-96c8-3f8fe5edfadc';
UPDATE funnel_stages SET key = '1002708400' WHERE id = '37e21da8-7e94-4a2a-8caa-6ab79fc5a1f5';
UPDATE funnel_stages SET key = '999374664' WHERE id = '55cb6f18-f0a7-4e42-bc35-58f55830cf49';
UPDATE funnel_stages SET key = '999374663' WHERE id = '4c351535-07f1-413a-aa14-2853c5ddd638';

-- Update deals that reference old keys to use new keys
UPDATE deals SET stage = 'appointmentscheduled' WHERE stage = 'prospeccao';
UPDATE deals SET stage = 'qualifiedtobuy' WHERE stage = 'reuni_o_agendada';
UPDATE deals SET stage = '1028864401' WHERE stage = 'aguardando_informa_es';
UPDATE deals SET stage = 'presentationscheduled' WHERE stage = 'proposta';
UPDATE deals SET stage = 'decisionmakerboughtin' WHERE stage = 'revis_o_de_proposta';
UPDATE deals SET stage = '1002708400' WHERE stage = 'negociacao';
UPDATE deals SET stage = '999374664' WHERE stage = 'fechado';
UPDATE deals SET stage = '999374663' WHERE stage = 'perdido';

-- Add missing stages from the image
INSERT INTO funnel_stages (key, label, sort_order, stage_type, is_system)
VALUES ('1137951889', 'Repescagem', 6, 'active', false);

INSERT INTO funnel_stages (key, label, sort_order, stage_type, is_system)
VALUES ('999377075', 'Novas Solicitações', 9, 'active', false);

-- Update default stage for deals table
ALTER TABLE deals ALTER COLUMN stage SET DEFAULT 'appointmentscheduled';
