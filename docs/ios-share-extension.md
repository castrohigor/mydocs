# iOS: ativar "Compartilhar → MyDocs"

No iOS, aparecer no menu Compartilhar exige uma **Share Extension** (um pequeno alvo extra no Xcode). O código já está pronto em `ios/ShareExtension/`; você só precisa criar o alvo.

1. `npm run ios` para abrir o projeto no Xcode.
2. **File → New → Target… → Share Extension**. Nome: `ShareExtension`. Linguagem Swift. Quando perguntar *Activate scheme?*, pode aceitar.
3. Substitua o `ShareViewController.swift` criado pelo Xcode pelo arquivo `ios/ShareExtension/ShareViewController.swift` deste repositório. Apague o `MainInterface.storyboard` gerado.
4. No `Info.plist` do alvo **ShareExtension**, use o conteúdo de `ios/ShareExtension/Info.plist` (regra de ativação para arquivos/imagens e `NSExtensionPrincipalClass` em vez do storyboard).
5. **App Group** — em *Signing & Capabilities*, adicione a capability **App Groups** com `group.com.mydocs.app` **nos dois alvos**: `App` e `ShareExtension`.
6. Confira que o *Deployment Target* da extensão é o mesmo do app (iOS 15+).
7. Rode o app no aparelho, abra um PDF em Arquivos/Mail, toque em Compartilhar → **MyDocs**.

### Como funciona

A extensão copia os arquivos para o container do App Group, grava a lista em `UserDefaults(suiteName: "group.com.mydocs.app")` na chave `share-target-data` e abre `mydocs://share`. O plugin `@capgo/capacitor-share-target` lê esses dados e dispara o evento `shareReceived`, que abre a tela **Arquivar**.

Se mudar o App Group, troque também `appGroupId` em `capacitor.config.ts` e a constante no `ShareViewController.swift`.
