-- Crear tablas para el modulo de Protesistas Dentales si no existen

CREATE TABLE IF NOT EXISTS "protesis_orders" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id" character varying NOT NULL,
  "performer_tenant_id" character varying NOT NULL,
  "patient_id" character varying NOT NULL,
  "status" character varying(50) NOT NULL DEFAULT 'received',
  "dental_work" jsonb NOT NULL,
  "requested_delivery" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "trazabilidad" jsonb,
  "conformidad" jsonb,
  CONSTRAINT "PK_protesis_orders" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "protesis_chats" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "order_id" uuid NOT NULL,
  "sender_id" character varying NOT NULL,
  "sender_name" character varying NOT NULL,
  "text_content" text NOT NULL,
  "attachment_meta" jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_protesis_chats" PRIMARY KEY ("id"),
  CONSTRAINT "FK_protesis_chats_order" FOREIGN KEY ("order_id") REFERENCES "protesis_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "protesis_insumos" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id" character varying NOT NULL,
  "name" character varying NOT NULL,
  "category" character varying NOT NULL,
  "stock" double precision NOT NULL DEFAULT 0,
  "min_stock" double precision NOT NULL DEFAULT 1,
  "unit" character varying NOT NULL DEFAULT 'Unidad',
  "additional_meta" jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_protesis_insumos" PRIMARY KEY ("id")
);
