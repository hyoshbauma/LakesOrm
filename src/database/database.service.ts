//
// import { Injectable, Singleton } from "#container";
import { Injectable, Singleton } from "../../container.ts";
import { databaseDataPath, schemaPath } from "./lakes/tools/location";

const structure = databaseDataPath + '/database.json';

@Singleton
@Injectable()
export class DatabaseService 
{
    
}








