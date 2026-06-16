import { prisma } from "../lib/prisma";

export type LoginUserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
};

const PASSWORD_COLUMN_CANDIDATES = ["passwordHash", "password_hash", "passwordhash"];
const USER_TABLE_PATTERNS = [/^users$/i, /^user$/i, /user/i];

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function isUserRelatedTable(tableName: string): boolean {
  return USER_TABLE_PATTERNS.some((pattern) => pattern.test(tableName));
}

async function getCurrentDatabaseName(): Promise<string> {
  const rows = await prisma.$queryRaw<{ database: string }[]>`
    SELECT current_database() AS database
  `;
  return rows[0]?.database ?? "unknown";
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

async function resolveUsersTable(schema: string, tables: string[]): Promise<string | null> {
  if (tables.includes("users")) {
    return "users";
  }

  const match = tables.find((table) => table.toLowerCase() === "users");
  return match ?? null;
}

async function listTableColumns(
  schema: string,
  tableName: string,
): Promise<string[]> {
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

type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

async function getMigrationStatus(tables: string[]): Promise<{
  exists: boolean;
  appliedCount: number;
  migrations: Array<{
    name: string;
    finishedAt: string | null;
    rolledBackAt: string | null;
  }>;
}> {
  if (!tables.includes("_prisma_migrations")) {
    return { exists: false, appliedCount: 0, migrations: [] };
  }

  const rows = await prisma.$queryRaw<MigrationRow[]>`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY finished_at NULLS LAST, migration_name
  `;

  const migrations = rows.map((row) => ({
    name: row.migration_name,
    finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
    rolledBackAt: row.rolled_back_at ? row.rolled_back_at.toISOString() : null,
  }));

  return {
    exists: true,
    appliedCount: migrations.filter((row) => row.finishedAt && !row.rolledBackAt).length,
    migrations,
  };
}

export const dbShapeService = {
  async getDatabaseShape() {
    const databaseName = await getCurrentDatabaseName();
    const schema = await getCurrentSchema();
    const tables = await listTables(schema);
    const usersTable = await resolveUsersTable(schema, tables);
    const userRelatedTables = tables.filter(isUserRelatedTable);
    const userTableColumns: Record<string, string[]> = {};

    for (const tableName of userRelatedTables) {
      userTableColumns[tableName] = await listTableColumns(schema, tableName);
    }

    const migrationStatus = await getMigrationStatus(tables);

    return {
      databaseName,
      schema,
      tables,
      userRelatedTables,
      userTableColumns,
      usersTable,
      usersColumns: usersTable ? userTableColumns[usersTable] ?? [] : [],
      expectedUsersTable: "users",
      expectedPasswordColumn: "passwordHash",
      migrations: migrationStatus,
    };
  },

  async getAuthCheck(email: string) {
    const schema = await getCurrentSchema();
    const tables = await listTables(schema);
    const usersTable = await resolveUsersTable(schema, tables);
    const usersColumns = usersTable ? await listTableColumns(schema, usersTable) : [];

    const emailColumn = usersTable ? resolveColumn(usersColumns, ["email"]) : null;
    const passwordColumn = usersTable
      ? resolveColumn(usersColumns, PASSWORD_COLUMN_CANDIDATES)
      : null;

    let matchingEmailExists = false;
    if (usersTable && emailColumn) {
      const tableSql = quoteIdent(usersTable);
      const emailSql = quoteIdent(emailColumn);
      const rows = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
        `SELECT EXISTS(SELECT 1 FROM ${tableSql} WHERE ${emailSql} = $1) AS exists`,
        email.trim().toLowerCase(),
      );
      matchingEmailExists = Boolean(rows[0]?.exists);
    }

    return {
      usersTableExists: Boolean(usersTable),
      emailColumnExists: Boolean(emailColumn),
      passwordHashColumnExists: Boolean(passwordColumn),
      matchingEmailExists,
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
    const tables = await listTables(schema);
    const usersTable = await resolveUsersTable(schema, tables);

    if (!usersTable) {
      throw new Error(`users table not found in schema ${schema}`);
    }

    const columns = await listTableColumns(schema, usersTable);
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
