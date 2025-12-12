var PRONTIO_DB_SPREADSHEET_ID = "1h6zr6ultbjK8Dx0c1hrlI0K8UF45plzJE8vHQe7JMck";

function PRONTIO_getDb_() {
  if (!PRONTIO_DB_SPREADSHEET_ID) {
    throw {
      code: "CONFIG_DB_ID_MISSING",
      message: "PRONTIO_DB_SPREADSHEET_ID não configurado em Config.gs.",
      details: "Cole o ID da planilha (Google Sheets) usada como banco de dados."
    };
  }

  return SpreadsheetApp.openById(PRONTIO_DB_SPREADSHEET_ID);
}
