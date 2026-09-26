// query-factory.ts

import type { DatabaseSchema } from "../interfaces/schema";
import { CryptoAes256C } from "../tools/crypto";
import { InsertBuilder, UpdateBuilder, UpsertQueryBuilder } from "./query-mutations";
import { QueryBuilder } from "./query-builder";
import { ConditionalQueryBuilder,  } from "./query-conditional";
import { JoinableQueryBuilder } from "./query-joins";
import * as crypto from 'crypto';
import { DatabaseServiceProvider } from "../../database.provider";
import { MigrationService } from "../migration.service";
// import { UserTable, type User } from "../tables/user";
import { Database } from "./database";
import { TransactionBuilder } from "./query-transaction";
import type { BuiltQuery } from "../interfaces/structure";
import type { PoolClient } from "pg";
// import { AppsTable } from "../tables/apps";
// import { KwanzoTable } from "../tables/kwanzo";

// Factory function that creates type-safe query builders
// The table name is constrained to keys of DatabaseSchema
export function from<K extends keyof DatabaseSchema>(
  table: K
): QueryBuilder<DatabaseSchema[K]> {
  return new QueryBuilder<DatabaseSchema[K]>(table);
}


// const userTable :  UserTable =  new UserTable();

// await app.insert(
//   [
//     { name: "Cupcake"},
//     { name: "Strawberry"},
//     { name: "Loginto"},
//   ]);

// const users : User[] = await userTable.getAll();



// newUser.save();

// Application
    
//  Layer ORM (repository + Hydrator + Model + command)

//  QueryBulder ( Query + SQl + command)

//  Driver (pg)

//  Database

    

// const user : UserTable =  new UserTable();
// const app : AppTable =  new AppTable();

// const alterUser = await UserTable.alterTable()
//   .addColumn('firstName', 'BOOLEAN')
//   // .addColumn('lastName', 'BOOLEAN')
//   .dropColumn('firstName')
//   .dropColumn('lastName')
//   .save();







// // This would cause a compile error - 'title' does not exist on User
// // const invalidQuerys = user.from()
// //   .select('title')  // Error: Argument of type 'title' is not assignable

// // select with fixed colums 
// export const userQueryColums = await userTable.fromQuery()
//   .select('id', 'firstName','lastName')
//   .whereEquals('remittancePermissions', false)
//   .get();

// // update many
// const updateMany = await userTable.updateQuery()
//   .set('telephone', '2439872312342')
//   .save();

// // // // update many
// const updateOne = await userTable.updateQuery()
//   .set('telephone', '243')
//   .where('id','=',2)
//   .save();

// // select with all colums 
// export const userQuerys = await userTable.fromQuery()
//   .selectAll()
//   .whereEquals('remittancePermissions', false)
//   // .whereJsonEquals('code',['status'], "draft")
//   // .whereJsonContains('code', { preferences: { theme: 'dark' } })
//   .orderBy('createdAt', 'DESC')
//   .get();



// // 
// export const userQueryCount = await userTable.fromQuery()
//   .whereEquals('remittancePermissions', false)
//   .count();


// const upsetQuery = await userTable.upsetQuery()
//   .values([
//     {
//       id: 1, 
//       firstName: 'Moise', 
//       lastName: 'Alice', 
//       telephone: '2324323423',
//       serdipayUserId: "1",
//       merchantId: "2",
//       merchantCode: "",
//       remittancePermissions: false
//     }
//   ])
//   .conflictOn('id')
//   .doUpdateSet('lastName', 'telephone')
//   .save();


// const deleteQuery = await userTable.deleteQuery()
// .where('id','>=',1)
// .where('id','>=',2)
// .save();

// postgres 18 uuidv7
// postgres 10 - 17 gen_random_uuid


// const userTableIs = await userTable.createTable()
//       .addColumn('id', 'UUID', { primaryKey: true , defaultFn: 'uuidv7()'})
//       .addColumn('serdipayUserId', 'VARCHAR(255)', { nullable: false })
//       .addColumn('merchantId', 'VARCHAR(255)', { nullable: false })
//       .addColumn('merchantCode', 'VARCHAR(255)', { nullable: false })
//       .addColumn('remittancePermissions', 'BOOLEAN', { nullable: false })
//       .addColumn('firstName', 'VARCHAR(255)')
//       .addColumn('lastName', 'VARCHAR(255)')
//       .addColumn('telephone', 'VARCHAR(255)', {unique: true})
//       .addIndex('users_telephone_index', ['telephone'])
//       .build();

// const userTableI = await userTable.alterTable()
      // .addColumn('telephones', 'VARCHAR(255)', {unique: true})
      // .addIndex('users_telephones_index', ['firstName'])
      // .dropColumn('telephones')
      // .save();
  // 3. Example Usage

// async function runTransactionExample() {
    

//     try {
        
//         // 1. Initialize the Transaction Builder
//         const txBuilder = new TransactionBuilder();

//         // start the Transaction
//         await txBuilder.begin();

//         // --- Define the Transaction Logic ---

//         // Operation 1: Insert data
//         await txBuilder.addOperation(async (c) => {
//             console.log("-> Step 1: Inserting user...");

//             const insertQuery: BuiltQuery = userTable.createQuery()
//             .values({
//                 serdipayUserId: '1',
//                 merchantId: "0121131",
//                 merchantCode: "02345",
//                 remittancePermissions: false,
//                 firstName: 'Moise',
//                 lastName: 'Bauma',
//                 telephone: "24398321432141",
//                 createdAt: new Date(),
//                 updatedAt: new Date()
//             })
//             .build();

//             await c.query(insertQuery.sql, insertQuery.params);
//         });

//         // Operation 2: Bulk Insert data
//         await txBuilder.addOperation(async (c) => {
//             console.log("-> Step 2: Bulk Inserting user...");

//             // // Usage Multible insert
//             const insertBulkQuery = userTable.insertQuery()
//             .values(
//                 [
//                 {
//                     serdipayUserId: '2',
//                     merchantId: "0121131",
//                     merchantCode: "02345",
//                     remittancePermissions: false,
//                     firstName: 'Moise',
//                     lastName: 'Bauma',
//                     telephone: "24398321432142"
//                 },
//                 {
//                     serdipayUserId: '3',
//                     merchantId: "0121131",
//                     merchantCode: "02345",
//                     remittancePermissions: false,
//                     firstName: 'Moises',
//                     lastName: 'Baumas',
//                     telephone: "243983214321413"
//                 }
//                 ],
//             )
//             .build();

//             await c.query(insertBulkQuery.sql, insertBulkQuery.params);
//         });

//         // Operation 3: Insert related data (Simulate a failure for testing rollback)
//         txBuilder.addOperation(async (c) => {
//             console.log("-> Step 3: Inserting order...");
//             // Simulate an error condition if needed:
//             // throw new Error("Simulated database failure!"); 
//             await c.query('INSERT INTO orders (user_id) VALUES (1)');
//         });



//         // 3. Execute the transaction block
//         const result = await txBuilder.execute();
//         console.log("✅ Final Result:", result);


//     } catch (error) {
//         console.error("❌ FATAL ERROR: The entire process failed.", error);
//     } 

    // try {
    //     // 1. BEGIN
    //     await transaction.begin();

    //     // // 2. Add Operations (The Query Building Phase)
    //     // const statement1: BuiltQuery = {
    //     //     sql: 'INSERT INTO accounts (user_id, balance) VALUES ($1, $2)',
    //     //     params: [ 101, 500 ],
    //     // };
    //     // transaction.query(statement1);

    //     // const statement2: BuiltQuery = {
    //     //     sql: 'UPDATE accounts SET balance = balance - $1 WHERE user_id = $2',
    //     //     params: [100,  101 ]
    //     // };
    //     // transaction.query(statement2);

    //     // insert one
    //     const insertQuery = await userTable.createQuery()
    //     .values({
    //         serdipayUserId: '1',
    //         merchantId: "0121131",
    //         merchantCode: "02345",
    //         remittancePermissions: false,
    //         firstName: 'Moise',
    //         lastName: 'Bauma',
    //         telephone: "24398321432141",
    //         createdAt: new Date(),
    //         updatedAt: new Date()
    //     })
    //     .build();

    //     transaction.query(insertQuery);

        

    //     // Simulate a critical error during processing
    //     // if (true) { 
    //     //     throw new Error("Simulated critical database error!");
    //     // }

    //     // // Usage Multible insert
    //     // const insertBulkQuery = await userTable.insertQuery()
    //     // .values(
    //     //     [
    //     //     {
    //     //         serdipayUserId: '2',
    //     //         merchantId: "0121131",
    //     //         merchantCode: "02345",
    //     //         remittancePermissions: false,
    //     //         firstName: 'Moise',
    //     //         lastName: 'Bauma',
    //     //         telephone: "24398321432142"
    //     //     },
    //     //     {
    //     //         serdipayUserId: '3',
    //     //         merchantId: "0121131",
    //     //         merchantCode: "02345",
    //     //         remittancePermissions: false,
    //     //         firstName: 'Moises',
    //     //         lastName: 'Baumas',
    //     //         telephone: "243983214321413"
    //     //     }
    //     //     ],
    //     // )
    //     // .save();

      

    //     // 3. COMMIT (Only reached if no errors occurred)
    //     transaction.commit();

    // } catch (error) {
    //     // console.log(transaction.isTransactionActive);
    //     // 4. ROLLBACK (Executed upon failure)
    //     // console.error(`\nOperation Failed: ${error instanceof Error ? error.message : String(error)}`);
    //     await transaction.rollback();
    // }
// }

// runTransactionExample();





export function queryFactory ()
{
  
//   runTransactionExample();
 

  // console.log(userTableI);

  // console.log(insertQuery);
  // console.log(insertBulkQuery);
  // console.log(upsetQuery);
  // // console.log(userQueryCount);
  // console.log(userQuerys);
  // console.log(updateOne);
  // console.log(updateMany);
  //  console.log(deleteQuery);
  

  // ==========================================
  // Usage Example
  // ==========================================
  
  // 1. Generate a raw, cryptographically secure 32-byte key
  // const fixedSecretKey = crypto.randomBytes(32); 

  const fixedSecretKey = "P1G6tpneoQAlRZbZgdZ4on/8zMM+33JAtFT9VJn1QcsD=";
  
  
  // const aes = new CryptoAes256C(fixedSecretKey);
  // const secretMessage = "Highly confidential data.";
  
  // // 2. Encrypt
  // const encryptedPayload = aes.encrypt(secretMessage);
  // console.log('Encrypted Payload:', encryptedPayload);
  
  // // 3. Decrypt
  // const decryptedMessage = aes.decrypt(encryptedPayload);
  // console.log('Decrypted Message:', decryptedMessage);


}