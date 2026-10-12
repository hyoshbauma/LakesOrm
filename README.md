# Lakes ORM

LakesORM is a modern Object-Relational Mapper (ORM) built specifically for TypeScript (Bun) developers, designed to simplify PostgreSQL database interactions. Currently in the Staging phase, version 0.1.48 is an actively developed release, focusing on robust data modelling and type safety for complex applications.

---

## Tech Stack

| Layers | Technology |
|---|---|
| Node | Version 22, NPM version 11.19.0 |
| Database | PostgreSQL 18 or higher  |



## Quick Start

You need a Local NPM registry, this documentation is using verdaccio
verdaccio can be installed in 2 ways :

| Type | Installation details |
|---|---|
| NPM | `Install globally via npm`|  
| Docker| `Run a Docker container` | 



1. Install dependencies
```bash
bun install
```
2. To build the npm package:
```bash
bun run build
```

Skip step 3 if you have a local or online NPM registry; then update step 7 correctly


3.1 Install globally via npm (Local NPM registry)
```bash
npm install -g verdaccio
```
3.2 Launch the local registry by running:
```bash
verdaccio
```

By default, the server will start running at http://localhost:4873


3.3 Point npm to your Local Registry

```bash
npm config set registry http://localhost:4873/
```
Alternatively, create a .npmrc file inside a specific project root and add registry=http://localhost:4873/ to isolate its use


3.4 To publish packages, create a user profile in your local instance:

```bash
npm adduser --registry http://localhost:4873/
```
4. Run npm publish inside the LakesORM directory.

```bash
npm publish
```


5. Create a new Bun project
```bash
bun create hono@latest my-app
```

6. cd into the project you have created
```bash
cd my-app
```

8. Install the npm dependency from Verdaccio
```bash
bun add  @blm/lakeorm
```

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Set connection to Postgres |

Full variable reference: [.env.example](.env.example)


## Folders and Files Command Setup

Before runing any commands, please add this to your

```typescript
// Then add the dev command to your existing package.json.
{
  "scripts": {
    "dev": "lakes": "bun run ./src/database/lakes/ctl.ts"
    }
}
```

Before using the foreign key

```typescript
// Then add this in your tsconfig.json
"compilerOptions": {

    //....

    "paths": {
        "src/*": ["./src/*"],
        "@lakes/*": ["./src/database/lakes/*"]
        }
}
```

```bash

# Create  these folders and inside them create the file named ctl.ts
./
└── src/
    └── database/
        └── lakes/
            └── ctl.ts


# please copy this in the ctl.ts file

#. All migration files and Repository files will be in lakes directory, migration direction and tables directory respectively

```

To initialize the command layer, you need to configure the Lakecopy the code below in the ctl.ts file


```typescript
// ctl.ts

import { LakesCtlFacade, LakesServiceProvider, lakesOrmCtl } from '@blm/lakeorm';

// Instantiate the ORM Provider
const lakesProvider = new LakesServiceProvider();

// Get the LakeCtlFacade
const lakesClt: LakesCtlFacade = lakesProvider.getLakesCtlOf();

// Import the ORM commands
const OrmCtl = lakesOrmCtl(lakesClt);

```

## Key Commands

Help commands
```bash
bun run lakes --help
```


Create a table's Repository, table's interface in one file and the migration file
```bash
bun run lakes table --create User
```
Or short format
```bash 
bun run lakes table -c User
```


Delete a table's Repository, table's interface in one file and the migration file
```bash
bun run lakes table --delete User
```
Or short format
```bash
bun run lakes table -d User
```


Migration system initialised (Just needed to run once Or Never)
```bash
bun run lakes migrate --init
```
Or short format
```bash
bun run lakes migrate -i
```

Migration status
```bash
bun run lakes migrate --status
```

Or short format
```bash
bun run lakes migrate -s
```

Run the migration up to the Database
```bash
bun run lakes migrate --up
```

Or short format
```bash
bun run lakes migrate -u
```
Run the migration down to the Database
```bash
bun run lakes migrate --down
```
Or short format
```bash
bun run lakes migrate -d
```

## Some Migration codes (Don't copy this code)

Some code are auto-generatated for you in the migration file, you have to add only the column like :  

Please remember that Tables' Interfaces needed to be configured/set first before working on the migration files

```typescript

// These types mirror your actual database tables
export interface User {
  readonly id? : number,
  firstName: string,
  lastName: string,
  telephone: string,
  createdAt?: Date,
  updatedAt?: Date,
}

```

This just a example of migration (part of it actualy)

```typescript

// src/database/lakes/migration/2026_09_30_121851_create_user.ts

// Run your schema changes here
public async up(): Promise<User | null> {
          
    return new UserTable().createTable()
        .addColumn('id', 'SERIAL', { primaryKey: true })  // default comes with the migration file
        .addColumn('firstName', 'TEXT') // to be added as you set your Interface
        .addColumn('lastName', 'TEXT')  // to be added as you set your Interface
        .addColumn('telephone', 'TEXT', {unique: true, nullable: false})  // to be se by you
        .addColumn('createdAt', 'TIMESTAMP WITH TIME ZONE', {defaultFn: 'NOW()'}) // default comes with the migration file
        .addColumn('updatedAt', 'TIMESTAMP WITH TIME ZONE', {defaultFn: 'NOW()'}) // default comes with the migration file
        .save();
}

```

Example of add Generated Column and Foreign Key

```typescript

// src/database/lakes/migration/2026_09_30_121783_create_order.ts

// Run your schema changes here
public async up(): Promise<Orader | null> {
          
    return new OrderTable().createTable()
        .addColumn('id', 'SERIAL', { primaryKey: true })
        .addColumn('quanty', 'INT', {nullable: false})
        .addColumn('price', 'INT', {nullable: false})
        .addGeneratedColumn('total', 'INT', ['quanty','price'], 'quanty * price')
        .addColumn('createdAt', 'TIMESTAMP WITH TIME ZONE', {defaultFn: 'NOW()'})
        .addColumn('updatedAt', 'TIMESTAMP WITH TIME ZONE', {defaultFn: 'NOW()'})
        .addColumn('userId', 'INT', { foreignKey: {table: 'user', column: 'id'}})
        .save();
}

```

Exemple of Insert

```typescript

// src/controller/user-controller.ts

// Insert One
const insertQuery: BuiltQuery = userTable.createQuery()
    .values({
      firstName: 'John',
      lastName: 'Kwena',
      telephone: "24398321432141",
      createdAt: new Date(),
      updatedAt: new Date()
    })
  .save();


//  Multible insert or builk insert
const insertBulkQuery = userTable.insertQuery()
  .values(
    [
      {
        firstName: 'Linda',
        lastName: 'Zhone',
        telephone: "24398321432142"
      },
      {
        firstName: 'Kakule',
        lastName: 'Bahati',
        telephone: "243983214321413"
      }
    ],
  )
  .save();



// upset Query
const upsetQuery  = await userTable.upsetQuery()
    .values(
      [
        {
          firstName: 'Linda',
          lastName: 'Zhone',
          telephone: "24398321432142"
        },
        {
          firstName: 'Kakule',
          lastName: 'Bahati',
          telephone: "243983214321413"
        }
      ]
    )
    .conflictOn('telephone') // these column must have unique constrain set
    .doUpdateSet('firstName', 'lastName', 'telephone')
    .save()

console.log(upsetQuery);

```


Example of ORM Transactions

```typescript 

// src/controller/user-controller.ts

// add this to your code

const userTable: UserTable = new UserTable();

const orderTable: OraderTable = new OraderTable();

try {
        
  // 1. Initialize the Transaction Builder
  const txBuilder = new TransactionBuilder();

  // start the Transaction
  await txBuilder.begin();

  // --- Define the Transaction Logic ---

  // Operation 1: Insert data
  txBuilder.addOperation(async (c) => {
    console.log("-> Step 1: Inserting user...");

    const insertQuery: BuiltQuery = userTable.createQuery()
      .values({
        firstName: 'John',
        lastName: 'Kwena',
        telephone: "24398321432141",
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .build();

    await c.query(insertQuery.sql, insertQuery.params);

  });

  // Operation 2: Bulk Insert data
  txBuilder.addOperation(async (c) => {
    console.log("-> Step 2: Bulk Inserting user...");

    // // Usage Multible insert
    const insertBulkQuery = userTable.insertQuery()
      .values(
        [
          {
            firstName: 'Linda',
            lastName: 'Zhone',
            telephone: "24398321432142"
          },
          {
            firstName: 'Kakule',
            lastName: 'Bahati',
            telephone: "243983214321413"
          }
        ],
      )
      .build();

      await c.query(insertBulkQuery.sql, insertBulkQuery.params);

  });

  // Operation 3: Insert related data (Simulate a failure for testing rollback)
  // txBuilder.addOperation(async (c) => {
  //     console.log("-> Step 3: Inserting order...");
  //     // Simulate an error condition if needed:
  //     // throw new Error("Simulated database failure!"); 
  //     await c.query('INSERT INTO orders (user_id) VALUES (1)');
  // });

  // Operation 3: Bulk Insert data
  txBuilder.addOperation(async (c) => {
    console.log("-> Step 2: Bulk Inserting user...");

    // // Usage Multible insert
    const insertBulkQuery = orderTable.insertQuery()
      .values(
        [
          {
            quanty: 2,
            price: 200,
            userId: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            quanty: 5,
            price: 600,
            userId: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          }      
        ],
    )
    .build();

    await c.query(insertBulkQuery.sql, insertBulkQuery.params);
        
  });



  // 3. Execute the transaction block
  const result = await txBuilder.execute();
  console.log("✅ Final Result:", result);


} catch (error) {
  console.error("❌ FATAL ERROR: The entire process failed.", error);
}  
```


Example of relationship

```typescript

// Run your schema changes here

// src/database/lakes/tables/user.ts

/*
* User Table 
*/
@Singleton
@Injectable()
export class UserTable extends BaseModel<User>{

  protected override tableName = 'users';
  // column to encrypt
  protected override encryptedColumns: ColumnNames<User>[] = [];
  // column to hide
  protected override hidden : ColumnNames<User>[] = [];
          
  constructor()
  {
    super('users');
  }

   // add the code below in your table base model

  /**
   * A function that defines the relationship configuration for an Order entity.
   * 
   * @param targetModel The model that the Order relates to (the Orader).
   * @returns The relationship configuration object.
   */
  public Orders(): belongsTo<Orader> {
    
    return {
      targetModel: new OrderTable(),
      foreignKey: 'userId',
      type: 'one'
    }
  }
    
    
    
} 



// src/controller/user-controller.ts

// add this to your code

const userTable: UserTable = new UserTable();

// user it like this
const usersOrder = await userTable.fromWithBuilder().withOnly(userTable.Orders()).selectAll().get();

console.log(usersOrder[0]);

// result
{
  id: 1,
  firstName: "John",
  lastName: "Kwame",
  telephone: "24398321432141",
  createdAt: 2026-10-10T08:51:27.978Z,
  updatedAt: 2026-10-10T08:51:27.978Z,
  orders: [
    {
      id: 1,
      quanty: 2,
      price: 200,
      total: 400,
      createdAt: 2026-10-10T08:51:27.984Z,
      updatedAt: 2026-10-10T08:51:27.984Z,
      userId: 1,
    }, {
      id: 2,
      quanty: 5,
      price: 600,
      total: 3000,
      createdAt: 2026-10-10T08:51:27.984Z,
      updatedAt: 2026-10-10T08:51:27.984Z,
      userId: 1,
    }
  ],
}
```
