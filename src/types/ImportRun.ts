export type ImportRun = {
  id: number;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedCompanies: number;
  importedContacts: number;
  createdAt: string;
};

export type NewImportRun = {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedCompanies: number;
  importedContacts: number;
};
