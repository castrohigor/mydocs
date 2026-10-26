/**
 * Preencha com os IDs do seu projeto no Google Cloud Console.
 * Veja o passo a passo no README ("Configurar o Google").
 */
export const environment = {
  production: false,
  google: {
    /** OAuth client do tipo "Web application" (usado no Android e no navegador). */
    webClientId: 'SEU_WEB_CLIENT_ID.apps.googleusercontent.com',
    /** OAuth client do tipo "iOS". */
    iOSClientId: 'SEU_IOS_CLIENT_ID.apps.googleusercontent.com',
  },
  /** Nome da pasta raiz criada no Google Drive. */
  driveRootFolderName: 'MyDocs',
};
