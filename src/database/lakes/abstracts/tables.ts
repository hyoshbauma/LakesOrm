import type { DatabaseSchema } from "../interfaces/schema";
import type {  CreateBuilder, InsertBuilder, UpdateBuilder } from "../builder/query-mutations";
import type { QueryBuilder } from "../builder/query-builder";
import type { JoinableQueryBuilder } from "../builder/query-joins";
import type { CreateTableBuilder, DeleteTableBuilder } from "../builder/query-structure";


export abstract class AbstractTableSchema<T extends object = DatabaseSchema> {

    abstract from(): QueryBuilder<T>;
    abstract selectJoin(): JoinableQueryBuilder<T>;
    abstract insert(): InsertBuilder<T>;
    abstract update(): UpdateBuilder<T>;
    abstract create():  CreateBuilder<T>;
    abstract dropTable(): DeleteTableBuilder<T>;
    abstract createTable(): CreateTableBuilder<T>;
}