function basicAuthConnect (username: string, password: string): (req: any, res: any, next: (err: Error) => any) => void;

export = basicAuthConnect;
