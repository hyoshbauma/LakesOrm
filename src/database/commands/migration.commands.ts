// import { migrationService } from "../lakes/lake.command";


// export async function migrationCommand (){

    
//     const secondArg: string | undefined = (process.argv.slice(2))[0];
    
//     const thirddArg: string | undefined = (process.argv.slice(3))[0];
    
//     // must have a secont argument
//     if(!secondArg)
//     {
//         console.log("please add a --flag argument !!");
//         process.exit(1)// No output
//     }
    
//     // must have a secont argument
//     if(!thirddArg)
//     {
//         console.log("please add a value argurment!!");
//         process.exit(1)// No output
//     }
    
//     let isResultSuccess : boolean = true;
    
    
//     switch (secondArg) {
//         case '--migration::tables':
    
//             await migrationTableArg(thirddArg);
//             break

//         case '--migration::refresh':

//             break;
    
//         case '--clear':
    
//             try {
                
                
//             } catch (error) {
//                 isResultSuccess = false;
//             }
//             break;
    
//         default:
    
//             console.log("flag doesn't check help!!");// No output
//             isResultSuccess = false;
//             break;
//     }
    
    
//     if(isResultSuccess){ process.exit(0); }else{process.exit(1);}
    
    
// }


// async function migrationTableArg (arg: string){

//     let results;

//     let isResultSuccess : boolean = true;

//     switch (arg) {
        
//         case 'all':

//             try {
    
//                 // add the table to db schema
//                 await migrationService.initialize();

//                 results = await migrationService.up(); 

//                 console.log('\nRollback summary:');
//                 results.forEach((r) => {
//                 console.log(`  ${r.status === 'success' ? 'OK' : 'FAIL'} ${r.name} (${r.duration}ms)`);
//                 });

//                 await migrationService.close();
                
//             } catch (error) {

//                 isResultSuccess = false;
    
//                 console.log("create table  error : ", error);
//             }

//              break;
        
//         case 'drop':

//             try {
                
//                 // add the table to db schema
//                 await migrationService.initialize();

//                 results = await migrationService.down();

//                 console.log('\nRollback summary:');
//                 results.forEach((r) => {
//                 console.log(`  ${r.status === 'success' ? 'OK' : 'FAIL'} ${r.name} (${r.duration}ms)`);
//                 });

//                 await migrationService.close();
    
//             } catch (error) {
//                 isResultSuccess = false;
    
//                 console.log("drop table error : ", error);
//             }
            
//             break;
    
//         default:
//             break;
//     }

//     if(isResultSuccess){ process.exit(0); }else{process.exit(1);}
// }
