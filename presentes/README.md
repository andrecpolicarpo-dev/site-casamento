# Site de presentes conectado ao Google Planilhas

## 1. Preparar a planilha

1. Faça upload de `planilha-presentes-google-sheets.xlsx` no Google Drive.
2. Abra o arquivo com o Google Planilhas.
3. Mantenha os cabeçalhos da aba `Presentes` exatamente como estão.
4. Preencha os links individuais do Mercado Pago na coluna `link_pagamento`.
5. Use `SIM` na coluna `ativo` para exibir e `NÃO` para ocultar um presente.

## 2. Publicar como CSV

No Google Planilhas:

1. Acesse **Arquivo > Compartilhar > Publicar na Web**.
2. Selecione apenas a aba **Presentes**.
3. Escolha o formato **Valores separados por vírgulas (.csv)**.
4. Clique em **Publicar**.
5. Copie a URL gerada.

## 3. Conectar o site

Abra `js/config.js` e substitua:

```javascript
sheetCsvUrl: "COLE_AQUI_A_URL_CSV_PUBLICADA"
```

pela URL CSV publicada.

## 4. Imagens

A coluna `imagem` pode conter:

- um nome local, como `presente-01.jpg`; ou
- uma URL pública completa começando com `https://`.

Para imagens locais, coloque os arquivos em:

```text
assets/images/
```

A capa esperada pelo CSS é:

```text
assets/images/capa.jpg
```

## 5. Atualizações

Após a configuração, qualquer mudança publicada na planilha será carregada pelo site quando a página for atualizada.

## Segurança

Não coloque senhas, tokens de API ou credenciais privadas na planilha. Nomes, preços, imagens e links de pagamento ficarão públicos.
