// import { databaseService } from "../lakes/lake.command";


// export async function tableCommand (){    
    
    
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
    

    
//     // let isSecondArgFit: boolean = false;
    
//     switch (secondArg) {
//         case '--table::create':
    
//             try {
    
//                 // add the table to db schema
//                 await databaseService.createTable(thirddArg);  
                
//             } catch (error) {
//                 isResultSuccess = false;
    
//                 console.log("create table  error : ", error);
//             }
//             break;
    
//         case '--table::delete':
    
//             try {
                
//                 await databaseService.deteleTable(thirddArg);
    
//             } catch (error) {
//                 isResultSuccess = false;
    
//                 // console.log("drop table error : ", error);
//             }
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