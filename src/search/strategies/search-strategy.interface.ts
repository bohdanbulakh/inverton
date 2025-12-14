import { DocumentInfoService } from '../document-info/document-info.interface';

export type SearchStrategy = (terms: string[], docInfoService: DocumentInfoService) => Promise<Map<string, number>>
