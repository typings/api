import { join } from 'path'

/* Paths */
export const DATA_PATH = join(__dirname, '../../../data')

/* Jobs */
export const JOB_UPDATE_DT = 'update definitelytyped'
export const JOB_UPDATE_TYPINGS = 'update typings'

/* Sources */
export const AMBIENT_SOURCES = ['dt', 'ambient']
export const MAIN_SOURCES = ['npm', 'bower', 'github', 'common']
export const ALL_SOURCES = MAIN_SOURCES.concat(AMBIENT_SOURCES)
