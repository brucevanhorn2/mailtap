import { ipcMain } from 'electron'
import { searchService } from '../services/SearchService'
import type { SearchQuery, SuggestRequest } from '@shared/types'

export function registerSearchIpc(): void {
  ipcMain.handle('search:query', async (_event, query: SearchQuery) => {
    return searchService.search(query)
  })

  ipcMain.handle('search:suggest', async (_event, req: SuggestRequest) => {
    return searchService.suggest(req)
  })
}
