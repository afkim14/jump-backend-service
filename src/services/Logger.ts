export class Logger {
    prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
    }
    
    /**
     * Logs message with non-error coloring. Also includes timestamp.
     * 
     * \x1b[33m%s\x1b[0m => formats standard log output with yellow coloring.
     * 
     * @param info - message to log
     */
    logInfo(info: string): void {
        console.log('\x1b[33m%s\x1b[0m', `[${new Date().toLocaleString()}] - ${this.prefix}: ${info}`);
    }

    /**
     * Logs message with error coloring. Also includes timestamp.
     *
     * \x1b[31m%s\x1b[0m => formats standard log output with red coloring.
     * 
     * @param info - error to log
     */
    logError(error: string): void {
        console.log('\x1b[31m%s\x1b[0m', `[${new Date().toLocaleString()}] - ${this.prefix}: ${error}`);
    }
}