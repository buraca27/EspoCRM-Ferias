# QR Expense Field Type — EsporCRM

Custom field type que abre a câmara, lê o QR code AT português em tempo real,
preenche os campos da despesa automaticamente e anexa a imagem ao record.

---

## Estrutura de ficheiros

```
custom/
  Espo/Custom/Resources/
    metadata/fields/
      qrExpense.json              ← definição do field type
    i18n/pt_PT/
      Global.json                 ← traduções PT
  
client/custom/src/views/fields/qr-expense/
  edit.js                         ← view de edição (câmara + QR + anexo)
  detail.js                       ← view de detalhe (read-only)
```

---

## Instalação

1. Copia os ficheiros para as pastas correspondentes no teu EsporCRM
2. Vai a **Admin → Clear Cache**
3. Vai a **Admin → Rebuild**

---

## Adicionar o field ao teu entity (Contabdoc)

1. **Admin → Entity Manager → Contabdoc → Fields → Add Field**
2. Tipo: `qrExpense`
3. Nome: `qrScanner` (ou o que preferires — é `notStorable`, não cria coluna na BD)
4. Guarda

5. **Admin → Entity Manager → Contabdoc → Layouts → Edit (Detail)**
6. Arrasta o field `qrScanner` para o topo do formulário
7. Guarda e faz **Clear Cache**

---

## Campos preenchidos automaticamente via QR AT

| Field no Espo   | Tipo    | Valor extraído do QR          |
|-----------------|---------|-------------------------------|
| `nifdocumento`  | varchar | NIF do emitente (campo A:)    |
| `subtotal`      | float   | Base tributável (I2/I4/I6:)   |
| `iva`           | float   | Valor de IVA (I3/I5/I7:)      |
| `taxaiva`       | float   | Taxa IVA em % (calculada)     |
| `total`         | float   | Total da fatura (campo O:)    |

O anexo é gravado em `documentocontabId` / `documentocontabName`.

---

## Fluxo

```
Utilizador abre record → toca "Scan Fatura"
        │
        ├─ Câmara traseira abre (getUserMedia, environment)
        │
        ├─ jsQR lê frames em tempo real (requestAnimationFrame)
        │
        ├─ QR AT detectado?
        │   ├─ SIM → parseia campos → preenche model → captura frame → anexa → fecha câmara
        │   └─ NÃO (15s timeout) → captura frame → anexa apenas → fecha câmara
        │
        └─ Utilizador confirma/corrige fields → guarda record normalmente
```

---

## Formato QR AT (referência)

```
A:NIF_EMITENTE*B:NIF_ADQUIRENTE*C:PAIS*D:TIPO*E:ATCUD*F:ESPACO_FISCAL*
G:DATA*H:CERT*I1:BASE_ISENTA*I2:BASE_RED*I3:IVA_RED*I4:BASE_INT*I5:IVA_INT*
I6:BASE_NORM*I7:IVA_NORM*N:TOTAL_IMPOSTOS*O:TOTAL*Q:HASH*R:CERT_NUM
```

---

## Requisitos

- EsporCRM 7.x ou superior
- HTTPS obrigatório (getUserMedia não funciona em HTTP)
- Browser mobile moderno (Chrome Android, Safari iOS 14.3+)
- jsQR carregado via CDN: `cdn.jsdelivr.net/npm/jsqr@1.4.0`
  (ou coloca o ficheiro local em `client/custom/lib/jsqr.min.js` e ajusta o path no edit.js)

---

## n8n — processamento assíncrono da imagem

O n8n pode ser configurado para:
1. Detectar novos records `Contabdoc` com `documentocontabId` preenchido
2. Descarregar a imagem via API do EsporCRM
3. Converter com ImageMagick/Ghostscript: JPEG → PDF B/W compacto
4. Re-upload do PDF e actualização do attachment no record

Webhook sugerido: `POST /api/v1/Contabdoc` → trigger n8n via EsporCRM hooks.

---

## Notas de segurança

- O field type não faz chamadas a APIs externas
- A câmara é usada apenas durante o scan e fechada imediatamente após
- Nenhuma imagem é enviada para fora do servidor EsporCRM
- O token de autenticação usado no upload do anexo é o token de sessão normal do Espo
