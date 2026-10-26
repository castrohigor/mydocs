# MyDocs 📇

Uma **carteira de documentos** para o celular, no estilo do app Carteira: seus PDFs, fotos e planilhas aparecem como cartões empilhados, organizados por pasta e tags — e tudo fica guardado no **seu Google Drive**.

Feito com **Ionic 9 + Angular 22 + Capacitor 8** (Android e iOS).

## O que ele faz

| Recurso | Como funciona |
|---|---|
| **Receber do "Compartilhar"** | Com um documento aberto em qualquer app (WhatsApp, Gmail, Arquivos, banco…), toque em *Compartilhar → MyDocs*. Abre a tela **Arquivar**: dê um nome (ex.: `CNH Higor`), escolha uma pasta existente ou crie uma nova, e adicione tags. Funciona com vários arquivos de uma vez. |
| **Tags e filtros** | Tags livres (ex.: `Higor`, `Comprovantes`) com sugestões das que você já usa. Na tela inicial, filtre por pasta, por uma ou mais tags e pela busca. |
| **Enviar vários** | Toque em *Selecionar* (ou segure um cartão), marque os documentos e toque em **Enviar**: os arquivos vão de verdade, não links. No e-mail viram anexos da mesma mensagem; no WhatsApp vão todos os arquivos. |
| **Organizar** | Remover, renomear, re-taguear e mover — individualmente ou em lote. Remover manda para a lixeira do Drive (recuperável por 30 dias). |
| **Google Drive** | Tudo é salvo em `Meu Drive/MyDocs/<pasta>/`. As tags ficam na descrição do arquivo (`#Higor #Comprovantes`), então dá para pesquisá-las no próprio Drive. |
| **Compartilhar como no Drive** | Em cada documento: convidar pessoas por e-mail (leitor/editor), criar link "qualquer pessoa com o link", enviar o link, ver quem tem acesso e revogar. |
| **Rápido e offline** | O índice fica salvo no aparelho e abre na hora; a sincronização com o Drive roda em segundo plano. Arquivos abertos ficam em cache. |

## Privacidade

O app pede só o escopo `drive.file`: ele **enxerga apenas os arquivos que ele mesmo criou** no seu Drive. Não há servidor intermediário — o celular fala direto com a API do Google.

## Estrutura

```
src/app/
  core/
    auth.service.ts       Login Google (@capgo/capacitor-social-login) e renovação do token
    drive.service.ts      API REST do Drive v3: pastas, upload, tags, mover, lixeira, permissões
    docs.store.ts         Estado (signals) + cache local do índice
    files.service.ts      Download/cache, abrir no app padrão, compartilhar vários arquivos
    share-in.service.ts   Recebe arquivos do menu "Compartilhar" (@capgo/capacitor-share-target)
  pages/
    home/                 A carteira: pilhas de cartões, filtros, seleção múltipla
    import/               Tela "Arquivar" (nome, pasta, tags)
    document/             Detalhe: pré-visualização, abrir, enviar, compartilhar no Drive, editar
    settings/             Conta, pastas (renomear, cor, remover), cache, sair
  components/             Cartão, campo de tags, seletor de pasta, editor de tags, compartilhamento Drive
android/                  Projeto Android (intent filters SEND / SEND_MULTIPLE já configurados)
ios/                      Projeto iOS + ShareExtension/ pronta para adicionar no Xcode
```

## Rodando

```bash
npm install
npm start            # navegador em http://localhost:4200 (login Google funciona na web também)
npm run android      # build + sync + abre no Android Studio
npm run ios          # build + sync + abre no Xcode
```

Requisitos: Node 22+, Android Studio (Android) e Xcode 16+ (iOS).

## Configurar o Google (obrigatório, ~10 min)

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto (ex.: *MyDocs*).
2. **APIs e serviços → Biblioteca** → ative a **Google Drive API**.
3. **Tela de consentimento OAuth / Google Auth Platform**: tipo *Externo*, preencha nome e e-mail. Em **Acesso a dados**, adicione o escopo `.../auth/drive.file`. Em **Público-alvo**, adicione seu e-mail como *usuário de teste* (enquanto o app estiver em modo de teste).
4. **Credenciais → Criar credenciais → ID do cliente OAuth**, crie três:
   - **Aplicativo da Web** — em *Origens JavaScript autorizadas* adicione `http://localhost:4200`. Copie o ID → `webClientId`.
   - **Android** — pacote `com.mydocs.app` e a impressão digital SHA-1 da sua chave (`cd android && ./gradlew signingReport`).
   - **iOS** — bundle ID `com.mydocs.app`. Copie o ID → `iOSClientId`, e o *iOS URL scheme*.
5. Cole os IDs em `src/environments/environment.ts` e `environment.prod.ts`.
6. iOS: em `ios/App/App/Info.plist`, troque `com.googleusercontent.apps.SEU_IOS_CLIENT_ID` pelo *iOS URL scheme* do passo 4.

> Quer outro identificador de app? Troque `com.mydocs.app` em `capacitor.config.ts`, `android/app/build.gradle` e no Xcode — e use o mesmo nas credenciais do Google.

## Receber arquivos pelo "Compartilhar"

- **Android**: já está pronto (`android/app/src/main/AndroidManifest.xml`). O MyDocs aparece para PDFs, imagens, planilhas e documentos.
- **iOS**: a Apple exige uma *Share Extension*, que é criada no Xcode. O código já está em `ios/ShareExtension/`; siga **[docs/ios-share-extension.md](docs/ios-share-extension.md)** (uns 5 minutos).

## Próximos passos sugeridos

- Pré-visualização de PDF dentro do app (ex.: `pdf.js`) e miniaturas nos cartões.
- Desbloqueio por biometria ao abrir o app.
- Lembretes de vencimento (CNH, passaporte) com notificações locais.
- Leitura de texto (OCR) para buscar dentro de imagens.
