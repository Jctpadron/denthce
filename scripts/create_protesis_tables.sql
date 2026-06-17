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
  "presupuesto_estimado" decimal(10,2),
  "presupuesto_final" decimal(10,2),
  "fecha_vencimiento" date,
  "estado_pago" character varying(20) NOT NULL DEFAULT 'pending',
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

CREATE TABLE IF NOT EXISTS "protesis_status_history" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "order_id" uuid NOT NULL,
  "from_status" character varying(50),
  "to_status" character varying(50) NOT NULL,
  "changed_by" character varying NOT NULL,
  "changed_by_name" character varying,
  "actor_type" character varying(20) NOT NULL DEFAULT 'clinica',
  "reason" text,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_protesis_status_history" PRIMARY KEY ("id"),
  CONSTRAINT "FK_protesis_status_history_order" FOREIGN KEY ("order_id") REFERENCES "protesis_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_protesis_status_history_order" ON "protesis_status_history"("order_id");

CREATE TABLE IF NOT EXISTS "protesis_insumos" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id" character varying NOT NULL,
  "name" character varying NOT NULL,
  "category" character varying NOT NULL,
  "stock" double precision NOT NULL DEFAULT 0,
  "min_stock" double precision NOT NULL DEFAULT 1,
  "precio_unitario" decimal(10,2),
  "unit" character varying NOT NULL DEFAULT 'Unidad',
  "additional_meta" jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_protesis_insumos" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "protesis_pagos" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "order_id" uuid NOT NULL,
  "monto" decimal(10,2) NOT NULL,
  "fecha_pago" TIMESTAMP NOT NULL DEFAULT now(),
  "metodo_pago" character varying(50) NOT NULL,
  "comprobante_ref" character varying(200),
  "notas" text,
  "registrado_por" character varying(100),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_protesis_pagos" PRIMARY KEY ("id"),
  CONSTRAINT "FK_protesis_pagos_order" FOREIGN KEY ("order_id") REFERENCES "protesis_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "protesis_consumo_insumos" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "order_id" uuid NOT NULL,
  "insumo_id" uuid NOT NULL,
  "cantidad" double precision NOT NULL,
  "costo_unitario" decimal(10,2) NOT NULL,
  "costo_total" decimal(10,2) NOT NULL,
  "lote" character varying(200),
  "registrado_por" character varying(100),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_protesis_consumo_insumos" PRIMARY KEY ("id"),
  CONSTRAINT "FK_protesis_consumo_insumos_order" FOREIGN KEY ("order_id") REFERENCES "protesis_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FK_protesis_consumo_insumos_insumo" FOREIGN KEY ("insumo_id") REFERENCES "protesis_insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_protesis_pagos_order" ON "protesis_pagos"("order_id");
CREATE INDEX IF NOT EXISTS "idx_protesis_consumo_insumos_order" ON "protesis_consumo_insumos"("order_id");
