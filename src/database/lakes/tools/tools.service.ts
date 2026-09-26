
import { Injectable } from "../../../../container";
import type { DateTimeLakes } from "../interfaces/structure";


@Injectable()
export class ToolLakesService 
{
    /*
    * capitalize First Letter
    **/
    capitalizeFirstLetter(str: string): string {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1);
    }


    chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const result: T[][] = [];
        
        for (let i = 0; i < array.length; i += chunkSize) {
            const chunk = array.slice(i, i + chunkSize);
            result.push(chunk);
        }
        
        return result;
    } 


    getDateTime(date:Date = new Date()): DateTimeLakes {
        // getMonth() is 0-indexed, so add 1
        const dateTime:  DateTimeLakes = {
            yeah:  date.getFullYear(),
            month: String(date.getMonth() + 1).padStart(2, '0'),
            day: String(date.getDate()).padStart(2, '0'),
            hours: String(date.getHours()).padStart(2, '0'),
            minutes: String(date.getMinutes()).padStart(2, '0'),
            seconds: String(date.getSeconds()).padStart(2, '0')
        }

        return dateTime;
    }
}