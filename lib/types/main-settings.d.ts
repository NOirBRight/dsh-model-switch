import { type CapabilityCatalog, type ModelSelection } from './capabilities.js';
export interface MainSettingsDocument {
    version: 1;
    defaultRoute: ModelSelection;
}
/** Decode storage without resolving availability, so invalid/uninstalled choices remain visible. */
export declare function parseMainSettingsDocument(input: unknown): MainSettingsDocument;
/** Validate only when a caller creates a new session; existing sessions never re-read this document. */
export declare function routeForNewSession(catalog: CapabilityCatalog, settings: MainSettingsDocument): ModelSelection;
