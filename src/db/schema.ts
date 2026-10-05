import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  numeric,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const trips = pgTable("trips", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  pdfUrl: text("pdf_url").notNull(),
  featured: boolean("featured").notNull().default(false),
  ...timestamps(),
});
export const passengerPhotos = pgTable("passenger_photos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  ...timestamps(),
});
export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  trip: text("trip").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const admins = pgTable("app_admins", {
  userId: uuid("user_id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const privateSchema = pgSchema("stg_private");
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});
export const receiptCounter = privateSchema.table("receipt_counter", {
  id: integer("id").primaryKey(),
  nextNumber: integer("next_number").notNull(),
  initialized: boolean("initialized").notNull().default(false),
});
export const receipts = privateSchema.table("receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: integer("number").unique().notNull(),
  requestId: uuid("request_id").unique().notNull(),
  fingerprint: text("fingerprint").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by").notNull(),
  client: text("client").notNull(),
  currency: text("currency").$type<"ARS" | "USD">().notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 14, scale: 6 }).notNull(),
  totalArs: numeric("total_ars", { precision: 18, scale: 2 }).notNull(),
  reservation: text("reservation").notNull(),
  passengers: integer("passengers").notNull(),
  travelDate: date("travel_date").notNull(),
  destination: text("destination").notNull(),
  paymentMethod: text("payment_method").notNull(),
  rateSource: text("rate_source").notNull(),
  quoteUpdatedAt: timestamp("quote_updated_at", { withTimezone: true }),
  templateVersion: text("template_version").notNull().default("v1"),
});
export const receiptDocuments = privateSchema.table("receipt_documents", {
  receiptId: uuid("receipt_id")
    .primaryKey()
    .references(() => receipts.id),
  content: bytea("content").notNull(),
  sha256: text("sha256").notNull(),
});
export const receiptShares = privateSchema.table(
  "receipt_shares",
  {
    tokenHash: text("token_hash").primaryKey(),
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => receipts.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by").notNull(),
  },
  (table) => [index("receipt_share_receipt_idx").on(table.receiptId)],
);

export const expenses = privateSchema
  .table(
    "expenses",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      requestId: uuid("request_id").unique().notNull(),
      fingerprint: text("fingerprint").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      createdBy: uuid("created_by").notNull(),
      paidOn: date("paid_on").notNull(),
      payee: text("payee").notNull(),
      concept: text("concept").notNull(),
      category: text("category").notNull(),
      currency: text("currency").$type<"ARS" | "USD">().notNull(),
      amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
      exchangeRate: numeric("exchange_rate", {
        precision: 14,
        scale: 6,
      }).notNull(),
      totalArs: numeric("total_ars", { precision: 18, scale: 2 }).notNull(),
      paymentMethod: text("payment_method").notNull(),
      reference: text("reference").notNull().default(""),
      notes: text("notes").notNull().default(""),
      voidedAt: timestamp("voided_at", { withTimezone: true }),
      voidedBy: uuid("voided_by"),
      voidReason: text("void_reason"),
    },
    (table) => [
      index("expense_paid_on_idx").on(table.paidOn),
      check(
        "expense_money_rules",
        sql`${table.currency} in ('ARS','USD') and ${table.amount} > 0 and ${table.exchangeRate} > 0 and (${table.currency} <> 'ARS' or ${table.exchangeRate} = 1) and ${table.totalArs} = round(${table.amount} * ${table.exchangeRate}, 2)`,
      ),
      check(
        "expense_text_rules",
        sql`length(trim(${table.payee})) between 1 and 120 and length(trim(${table.concept})) between 1 and 200`,
      ),
      check(
        "expense_void_rules",
        sql`(${table.voidedAt} is null and ${table.voidedBy} is null and ${table.voidReason} is null) or (${table.voidedAt} is not null and ${table.voidedBy} is not null and ${table.voidReason} is not null and length(trim(${table.voidReason})) between 3 and 300)`,
      ),
    ],
  )
  .enableRLS();
