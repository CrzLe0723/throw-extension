/**
 * Throw extension for MakeCode Arcade
 *
 * Severity:
 * 0 = Info
 * 1 = Warning
 * 2 = Fatal
 */

//% weight=100 color=#D40000 icon="\uf188" block="Throw"
namespace Throw {

    export class CustomError {
        public message: string;
        public name: string;
        public code: number;
        public severity: number;

        constructor(
            message: string,
            name: string = "Error",
            code: number = 404,
            severity: number = 1
        ) {
            this.message = message || "";
            this.name = name || "Error";
            this.code = code;
            this.severity = severity;
        }

        toString(): string {
            return this.name + ": " + this.message;
        }
    }

    // Current error state
    let pendingError: CustomError = null;
    let latestError: CustomError = null;
    let errorHandled = true;
    let totalErrors = 0;
    let defaultHandler: (error: CustomError) => void = null;
    let errorContextDepth = 0;
    let history: CustomError[] = [];
    let historyLimit = 20;

    // Create error
    /**
     * Creates a custom error with a message and optionally, a name, code and severity.
     * 
     * @param message Message of the error 
     * @param name Name of the error 
     * @param code Error code 
     * @param severity Severity of the error
     * 
     * @returns A custom error
     */
    //% block="create error with message $message|| name $name code $code severity $severity"
    //% blockSetVariable=error
    //% weight=100
    //% severity.shadow="throw_error_severity_shim"
    export function createError(
        message: string,
        name: string = "Error",
        code: number = 404,
        severity: number = 1
    ): CustomError {
        return new CustomError(message, name, code, severity);
    }

    /**
     * custom error shadow 
     * 
     * @param message Message of the error
     * @param name Name of the error
     * @param code Error code
     * @param severity Severity of the error
     * 
     * @returns A custom error
     */
    //% block="create error with message $message|| name $name code $code severity $severity"
    //% weight=98
    //% severity.shadow="throw_error_severity_shim"
    export function errorShadow(
        message: string,
        name: string = "Error",
        code: number = 404,
        severity: number = 1
    ): CustomError {
        return new CustomError(message, name, code, severity);
    }

    /**
     * Record a recoverable error 
     * 
     * @param error The error to throw
     */
    //% block="throw $error"
    //% error.shadow="variables_get" error.defl="error"
    //% weight=95
    export function throwError(error: CustomError): void {
        if (!error) {
            error = createError(
                "Unknown error", "Error", 404, 1
            );
        }

        pendingError = error;
        errorHandled = false;
        recordError(error);

        console.error(
            error.toString() + " (code " + error.code + ")"
        );

        // Dispatch immediately if outside a try/catch sequence.
        if (errorContextDepth === 0 && defaultHandler) {
            defaultHandler(error);
        }
    }

    /**
     * Throw a fatal error and stop the game
     * 
     * @param error Error to throw
     */
    //% block="throw fatal error $error"
    //% error.shadow="variables_get" error.defl="error"
    //% weight=94
    export function throwFatal(error: CustomError): void {
        if (!error) {
            error = createError(
                "Unknown fatal error", "FatalError", 999, 2
            );
        }

        pendingError = error;
        errorHandled = false;
        recordError(error);

        crashGame(error);
    }

    /**
     * Try a piece of code
     * 
     * @param body Code to try
     */
    //% block="try"
    //% handlerStatement=1
    //% weight=90
    export function tryBlock(body: () => void): void {
        pendingError = null;
        errorHandled = true;
        errorContextDepth++;

        body();

        errorContextDepth--;
    }

    /**
     * Catch a recorded error 
     * 
     * @param handler Code to catch
     */
    //% block="catch"
    //% handlerStatement=1
    //% weight=85
    export function catchBlock(handler: () => void): void {
        if (pendingError && !errorHandled) {
            errorHandled = true;
            handler();
        }
    }

    /**
     * Cleanup and dispatch unhandled errors
     * 
     * @param cleanup Code to run
     */
    //% block="finally"
    //% handlerStatement=1
    //% weight=80
    export function finallyBlock(cleanup: () => void): void {
        cleanup();

        if (pendingError && !errorHandled) {
            if (defaultHandler) {
                defaultHandler(pendingError);
            } else {
                console.error(
                    "Unhandled error: " +
                    pendingError.toString()
                );
            }
        }

        if (errorContextDepth > 0) {
            errorContextDepth--;
        }
    }

    /**
     * Access current error 
     * 
     * @returns Returns the current error
     */
    //% block="caught error"
    //% blockSetVariable=caughtError
    //% weight=75
    export function getCaughtError(): CustomError {
        return pendingError;
    }


    /**
     * Single Try/Catch/Finally API for TypeScript/JavaScript 
     * 
     * @param body Code to run/try 
     * @param catchHandler Code to run/catch if an error is caught 
     * @param cleanup Code to run after the try and catch statements
     */
    //% blockHidden=true
    export function run(
        body: () => void,
        catchHandler: (error: CustomError) => void,
        cleanup: () => void
    ): void {
        let previousError = pendingError;
        let previousHandled = errorHandled;

        pendingError = null;
        errorHandled = true;
        errorContextDepth++;

        try {
            body();

            // Cooperative errors are checked after body completes.
            if (pendingError && !errorHandled) {
                let caught = pendingError;
                errorHandled = true;
                catchHandler(caught);
            }
        } catch (e) {
            let caught: CustomError;

            if (e instanceof CustomError) {
                caught = e;
            } else {
                caught = createError(
                    "Unexpected error",
                    "RuntimeError",
                    500,
                    1
                );
            }

            pendingError = caught;
            errorHandled = true;
            recordError(caught);

            catchHandler(caught);
        } finally {
            cleanup();
            errorContextDepth--;

            // Preserve an earlier unhandled error if one existed.
            if (previousError && !previousHandled) {
                pendingError = previousError;
                errorHandled = false;
            }
        }
    }

    /**
     * Rethrow current error 
     *
     */
    //% block="rethrow caught error"
    //% weight=70
    export function rethrow(): void {
        if (pendingError) {
            errorHandled = false;

            if (errorContextDepth === 0 && defaultHandler) {
                defaultHandler(pendingError);
            }
        }
    }

    /**
     * Get the error code of an error 
     * 
     * @param error Error to get the code 
     * 
     * @returns Returns the error code, otherwise 0
     */
    //% block="error code of $error"
    //% error.shadow="variables_get"
    //% weight=65
    export function errorCode(error: CustomError): number {
        return error ? error.code : 0;
    }

    /**
     * Get the error severity of an error
     *
     * @param error Error to get the severity
     *
     * @returns Returns the error severity, otherwise 0
     */
    //% block="severity of $error"
    //% error.shadow="variables_get"
    //% weight=60
    export function severityOf(error: CustomError): number {
        return error ? error.severity : 0;
    }

    /**
     * Checks the specified error if it's fatal 
     * 
     * @param error Error to check 
     * 
     * @returns True if fatal; false otherwise
     */
    //% block="is fatal error $error"
    //% error.shadow="variables_get"
    //% weight=55
    export function isFatal(error: CustomError): boolean {
        return !!error && error.severity >= 2;
    }

    /**
     * Logs a warn statement to the console
     * 
     * @param message Message to log
     */
    //% block="warn $message"
    //% weight=50
    export function warn(message: string): void {
        console.warn("[Throw warning] " + message);
    }

    /**
     * Get the total amount of errors thrown 
     * 
     * @returns Returns the total amount of errors thrown
     */
    //% block="total errors thrown"
    //% weight=45
    export function errorCount(): number {
        return totalErrors;
    }

    /**
     * Get the latest error 
     * 
     * @returns Returns a CustomError
     */
    //% block="last error"
    //% blockSetVariable=lastError
    //% weight=40
    export function lastError(): CustomError {
        return latestError;
    }

    /**
     * Register a default handler for unhandled errors.
     * 
     * @param handler Code to run
     */
    //% block="on unhandled error $error"
    //% blockSetVariable=unhandledError
    //% handlerStatement=1
    //% weight=35
    export function onUnhandledError(
        handler: (error: CustomError) => void
    ): void {
        defaultHandler = handler;
    }

    /**
     * Registers a recover handler
     * 
     * @param action Code to run 
     */
    //% block="recover with"
    //% handlerStatement=1
    //% weight=30
    export function recover(action: () => void): void {
        action();
        errorHandled = true;
    }

    /**
     * Display an error and crash the game 
     * 
     * @param error The CustomError object
     */
    //% block="crash game with $error"
    //% error.shadow="variables_get"
    //% weight=20
    export function crashGame(error: CustomError): void {
        if (!error) {
            error = createError(
                "Unknown fatal error", "FatalError", 999, 2
            );
        }

        pendingError = error;
        errorHandled = false;
        recordError(error);

        game.showLongText(
            "FATAL: " + error.toString() +
            "\nCode: " + error.code,
            DialogLayout.Full
        );

        control.panic(error.code > 0 ? error.code : 999);
    }

    /**
     * Get the number of errors currently stored in history.
     * 
     * @returns The history size of thrown errors (up to 20).
     */
    //% block="error history size"
    //% weight=39
    export function historySize(): number {
        return history.length;
    }

    /**
     * Get an error from history.
     * Index 0 is the oldest stored error.
     * 
     * @param index Index in the history list 
     * 
     * @returns The CustomError object in that index
     */
    //% block="error at history index $index"
    //% blockSetVariable=historyError
    //% weight=38
    export function errorAt(index: number): CustomError {
        if (index < 0 || index >= history.length) {
            return null;
        }

        return history[index];
    }

    /**
     * Clear stored error history.
     */
    //% block="clear error history"
    //% weight=37
    export function clearHistory(): void {
        history = [];
    }

    /**
     * Change how many recent errors are stored.
     * 
     * @param limit History limit for thrown errors 
     */
    //% block="set error history limit to $limit"
    //% weight=36
    export function setHistoryLimit(limit: number): void {
        historyLimit = Math.max(1, Math.min(100, limit));

        while (history.length > historyLimit) {
            history.shift();
        }
    }

    function recordError(error: CustomError): void {
        latestError = error;
        totalErrors++;

        history.push(error);

        // Keep only the most recent 20 errors.
        if (history.length > historyLimit) {
            history.shift();
        }
    }

    /**
     * Error severity shim
     */
    //% shim=ENUM_GET
    //% blockId=throw_error_severity_shim
    //% block="Severity $arg"
    //% enumName="Error_Severity"
    //% enumMemberName="severity"
    //% enumPromptHint="e.g. Warning, Fatal, ..."
    //% enumInitialMembers="Low, Medium, High"
    export function _errorSeverityShim(arg: number) {
        // This function should do nothing, but must take in a single
        // argument of type number and return a number value.
        return arg;
    }
}