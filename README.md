# Lakes ORM

LakesORM is a modern Object-Relational Mapper (ORM) built specifically for TypeScript (Bun) developers, designed to simplify PostgreSQL database interactions. Currently in the Staging phase, version 0.1.48 is an actively developed release, focusing on robust data modelling and type safety for complex applications.

---

## Tech Stack

| Layers | Technology |
|---|---|
| Node | Version 22, NPM version 11.19.0 |
| Database | PostgreSQL 18 or higher  |



## Quick Start

You need a Local NPM registry; this documentation uses Verdaccio
Verdaccio can be installed in 2 ways :

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

Before runing any commands, please add this to your package.json

```typescript
// Then add the dev command to your existing package.json
{
  "scripts": {
    "dev": "lakes": "bun run ./src/database/lakes/ctl.ts"
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

```bash
# Run the migration down to the Database
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

Example of add Generated Column

```typescript

// Run your schema changes here
public async up(): Promise<Orader | null> {
          
    return new OrderTable().createTable()
        .addColumn('id', 'SERIAL', { primaryKey: true })
        .addColumn('quanty', 'INT', {nullable: false})
        .addColumn('price', 'INT', {nullable: false})
        .addGeneratedColumn('total', 'INT', ['quanty','price'], 'quanty * price')
        .addColumn('createdAt', 'TIMESTAMP WITH TIME ZONE', {defaultFn: 'NOW()'})
        .addColumn('updatedAt', 'TIMESTAMP WITH TIME ZONE', {defaultFn: 'NOW()'})
        .save();
}

```


