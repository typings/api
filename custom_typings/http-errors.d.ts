declare function httpErrors (code: number): Error
declare function httpErrors (message: string): Error
declare function httpErrors (properties: any): Error
declare function httpErrors (code: number, message: string, properties?: any): Error

export = httpErrors