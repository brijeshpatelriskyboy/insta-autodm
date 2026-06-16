import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type LoginUserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
};

const PASSWORD_COLUMN_CANDIDATES = ["passwordHash", "password_hash", "passwordhash"];

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function getCurrentSchema(): Promise<string> {
  const rows = await prisma.$queryRaw<{ schema: string }[]>`
    SELECT current_schema() AS schema
  `;
  return rows[0]?.schema ?? "public";
}

async function listTables(schema: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ${schema}
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return rows.map((row) => row.table_name);
}

async function resolveUsersTable(schema: string): Promise<string | null> {
  const tables = await listTables(schema);
  if (tables.includes("users")) {
    return "users";
  }

  const match = tables.find((table) => table.toLowerCase() === "users");
  return match ?? null;
}

async function listUserColumns(schema: string, tableName: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = ${schema}
      AND table_name = ${tableName}
    ORDER BY ordinal_position
  `;
  return rows.map((row) => row.column_name);
}

function resolveColumn(columns: string[], candidates: string[]): string | null {
  const normalized = new Map(columns.map((column) => [column.toLowerCase(), column]));
  for (const candidate of candidates) {
    const match = normalized.get(candidate.toLowerCase());
    if (match) {
      return match;
    }
  }
  return null;
}

export const dbShapeService = {
  async getDatabaseShape() {
    const schema = await getCurrentSchema();
    const tables = await listTables(schema);
    const usersTable = await resolveUsersTable(schema);
    const usersColumns = usersTable ? await listUserColumns(schema, usersTable) : [];

    return {
      schema,
      tables,
      usersTable,
      usersColumns,
      expectedUsersTable: "users",
      expectedPasswordColumn: "passwordHash",
    };
  },

  async findUserByEmailQuoted(email: string): Promise<LoginUserRecord | null> {
    const rows = await prisma.$queryRaw<LoginUserRecord[]>`
      SELECT "id", "email", "passwordHash", "name"
      FROM "users"
      WHERE "email" = ${email}
      LIMIT 1
    `;
    return rows[0] ?? null;
  },

  async findUserByEmailIntrospected(email: string): Promise<LoginUserRecord | null> {
    const schema = await getCurrentSchema();
    const usersTable = await resolveUsersTable(schema);

    if (!usersTable) {
      throw new Error(`users table not found in schema ${schema}`);
    }

    const columns = await listUserColumns(schema, usersTable);
    const idColumn = resolveColumn(columns, ["id"]);
    const emailColumn = resolveColumn(columns, ["email"]);
    const nameColumn = resolveColumn(columns, ["name"]);
    const passwordColumn = resolveColumn(columns, PASSWORD_COLUMN_CANDIDATES);

    if (!idColumn || !emailColumn || !passwordColumn) {
      throw new Error(
        `users table missing required columns (found: ${columns.join(", ")})`,
      );
    }

    const tableSql = quoteIdent(usersTable);
    const idSql = quoteIdent(idColumn);
    const emailSql = quoteIdent(emailColumn);
    const passwordSql = quoteIdent(passwordColumn);

    const selectSql = nameColumn
      ? `SELECT ${idSql} AS id, ${emailSql} AS email, ${passwordSql} AS "passwordHash", ${quoteIdent(nameColumn)} AS name`
      : `SELECT ${idSql} AS id, ${emailSql} AS email, ${passwordSql} AS "passwordHash", NULL::text AS name`;

    const rows = await prisma.$queryRawUnsafe<LoginUserRecord[]>(
      `${selectSql} FROM ${tableSql} WHERE ${emailSql} = $1 LIMIT 1`,
      email,
    );

    return rows[0] ?? null;
  },
};
