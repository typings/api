import { exec as execDt } from './dt'
import { exec as execTypings } from './typings'

Promise.all([
  execDt(),
  execTypings()
])
  .then(([dt, typings]) => {
    console.log(`Indexed ${dt.length} new commits from DefinitelyTyped and ${typings.length} new commits from Typings`)
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
