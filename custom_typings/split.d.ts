import stream = require('stream')

interface SplitOptions {
  trailing?: boolean;
  maxLength?: number;
}

type Mapper = (line: string) => any;

function split (matcher?: Mapper | RegExp | string, mapper?: Mapper, options?: SplitOptions): stream.Transform;

export = split;
