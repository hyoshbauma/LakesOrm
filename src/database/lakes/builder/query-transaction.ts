import type { Pool, PoolClient } from "pg";
import { Singleton } from "../../../../container";
import type { BuiltQuery } from "../interfaces/structure";
import { Database } from "./database";


/**
 * Defines the types of operations that can occur within a transaction.
 */
type TransactionOperation = (client: PoolClient) => Promise<void>;

// The Transaction Manager Class
// @Singleton
export class TransactionBuilder extends Database {

    private client: PoolClient | null = null;
    private operations: TransactionOperation[] = [];
    private isTransactionActive: boolean = false;

    /**
     * @param client The active PostgreSQL client connection to use for the transaction.
     */
    constructor() {
        super();
    }

    /**
     *  Start the transaction
     */
    async begin(): Promise<void>{
        this.isTransactionActive = true;
        await this.getPoolClient();
    }

    /**
     *  Acquire a client from the pool
     * @param PoolClient The async function to get PoolClient.
     */
    private async getPoolClient (): Promise<PoolClient>{
        return this.client = await this.postgres!.connect();
    }

    /**
     * Adds a query/operation to the list of pending execution steps.
     * @param operation The async function to execute.
     */
    public addOperation(operation: TransactionOperation): this {
        if (!this.isTransactionActive) {
            throw new Error("Transaction must be started before adding operations.");
        }
        this.operations.push(operation);
        return this;
    }

    /**
     * Executes all queued operations within a single transaction.
     * This method handles the BEGIN, execution, COMMIT, and ROLLBACK logic.
     * @returns A promise that resolves with the results of the transaction.
     */
    public override async execute(): Promise<any> {

        let transactionSuccessful = false;

        this.client = await this.getPoolClient();
        
        // 1. Start the transaction
        try {
            await this.client.query('BEGIN');
            this.isTransactionActive = true;

            // 2. Execute all queued operations sequentially
            for (const operation of this.operations) {
                // The operation must handle its own execution and potential error throwing
                await operation(this.client);
            }

            // 3. If successful, commit the transaction
            await this.client.query('COMMIT');
            transactionSuccessful = true;
            console.log("Transaction successfully committed.");
            return { success: true, message: "Transaction completed." };

        } catch (error) {

            // 4. If any operation fails, roll back the transaction
            console.error("Transaction failed. Initiating ROLLBACK:", error);

            try {

                await this.client.query('ROLLBACK');
                console.log("Transaction successfully rolled back.");

            } catch (rollbackError) {
                // Handle potential error during rollback (rare, but possible)
                console.error("CRITICAL: Failed to rollback transaction:", rollbackError);
            }

            // 4. Release the client back to the pool
            if (this.client) {
                this.client.release();
                console.log("Client released back to pool.");
            }


            console.error(`Transaction failed and was rolled back: ${error}`);
            // throw new Error(`Transaction failed and was rolled back: ${error}`);

        } finally {
            // Reset state regardless of success or failure
            this.isTransactionActive = false;
            this.operations = [];

            
        }
    }

    /**
     * Finalizes the sequence and returns the full SQL log.
     * Note: This is usually called after commit() or rollback().
     */
    // public getTransactionLog(): { sql: string; success: boolean }[] {
    //     return this.sqlCommands.map(sql => ({ sql, success: true }));
    // }
    
    // private isActive: boolean = false;

    // constructor() { 
    //     // 'any' represents your actual DB connection/client
    //     super();
    //     console.log("Transaction Manager initialized.");
    // }

    // /**
    //  * Begins a transaction.
    //  */
    // public async begin(): Promise<void> {
    //     if (this.isActive) {
    //         throw new Error("Transaction is already active.");
    //     }
    //     this.isActive = true;

    //     console.log("Transaction is activated.");

    //     try {
    //         // -- This cleans the slate.,
    //         await this.execute({
    //             sql : `BEGIN ;` ,
    //             params: []
    //         });
            
    //     } catch (error: any) {

    //         console.log("Error : "+error.message);
    //     }
    // }

    // /**
    //  * Adds a statement to the transaction log.
    //  */
    // public async query(statement: BuiltQuery): Promise<void> {
    //     if (!this.isActive) {
    //         throw new Error("Cannot add statement. Transaction must be started first.");
    //     }

    //     console.log(`[SQL Queued]: ${statement.sql}`);
        

    //     try {
    //         // run the query
    //         await this.execute(statement);
            
    //     } catch (error: any) {

    //         console.log("Error : "+error.message);
    //     }
        
    // }

    // /**
    //  *  Set a checkpoint
    //  */
    // public async setCheckpoint(checkpoint: string): Promise<void> {
    //     // check if transaction has started
    //     if (!this.isActive) {
    //         throw new Error("Cannot add statement. Transaction must be started first.");
    //     }

    //     console.log("Set Transaction check point");

    //     // -- Set a transaction checkpoint
    //     await this.execute({
    //         sql: `SAVEPOINT ${checkpoint};`,
    //         params: []
    //     });
    // }

    // /**
    //  * Commits all pending operations successfully.
    //  */
    // public async commit(): Promise<void> {
    //     if (!this.isActive) {
    //         throw new Error("No active transaction to commit.");
    //     }

    //     console.log("Transaction has been commited");

    //     try {
    //          // -- Permanently saves all update
    //         await this.execute({
    //             sql: `COMMIT ; `,
    //             params: []
    //         });
            
    //     } catch (error: any) {

    //         console.log("Error : "+error.message);
    //     }
    // }

    // /**
    //  * Rolls back all operations if an error occurs.
    //  */
    // public async rollback(): Promise<void> {
    //     if (!this.isActive) {
    //         console.log("No active transaction to rollback.");
    //         return;
    //     }

    //     console.log("Transaction has been Rollback");

    //     // -- This cleans the slate.
    //     await this.execute({
    //         sql: `ROLLBACK ; `,
    //         params: []
    //     });
        
    // }

    // /**
    //  * Rolls back Only one check point if an error occurs.
    //  */
    // public async rollbackPartial(checkpoint: string): Promise<void> {
    //     if (!this.isActive) {
    //         console.log("No active transaction to rollback.");
    //         return;
    //     }

    //     // -- Undoes ONLY that check point step"
    //     await this.execute({
    //         sql: `ROLLBACK TO SAVEPOINT ${checkpoint} ; `,
    //         params: []
    //     });
    // }
}
