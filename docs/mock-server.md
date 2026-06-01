# Tutorial: Como Adicionar uma Nova Rota no Mock Server

No desenvolvimento de testes de carga com o **Pulse Framework**, é uma prática recomendada (e extremamente eficiente) validar os seus scripts localmente antes de disparar requisições contra ambientes de staging ou produção. Para possibilitar testes herméticos e rápidos com dependência zero de serviços externos, o Pulse traz um **Mock Server integrado** rodando na porta `3333`.

O mock server é baseado na biblioteca [json-server](https://github.com/typicode/json-server) (construída sob o Express.js). Este tutorial explica como adicionar novas rotas ao servidor de mock utilizando duas abordagens: **dados estáticos (CRUD automático)** ou **lógica programática customizada**.

---

## 1. Arquitetura do Mock Server

Os arquivos do Mock Server estão localizados no diretório `/data`:

```text
├── data/
│   ├── db.json          # Banco de dados mock em formato JSON (CRUD Automático)
│   └── server.js        # Configuração do servidor e middlewares (Lógica Customizada)
```

Para subir o Mock Server, você pode utilizar o comando CLI do Pulse ou rodar via NPM:

```bash
pulse mock
# ou
npm run mock-server
```

---

## 2. Abordagem A: Rotas CRUD Automáticas (`db.json`)

Se a sua rota precisa apenas expor recursos simples de consulta ou persistência (como listar dados, buscar por ID ou criar um registro estático), você pode utilizar a geração de rotas automática do `json-server`.

Qualquer chave adicionada no nó raiz do arquivo `data/db.json` será automaticamente transformada em um conjunto completo de endpoints REST (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).

### Passo a Passo

1. Abra o arquivo [data/db.json](file:///mnt/d/Pulse/data/db.json).
2. Adicione a sua nova chave com um array contendo os dados iniciais do seu mock.

#### Exemplo de Código (`data/db.json`)

Suponha que você queira adicionar um mock de catálogo de produtos sob a rota `/products`:

```json
{
  "sample": [
    {
      "id": 1,
      "name": "Initial Sample Data",
      "status": "active"
    }
  ],
  "users": [
    ...
  ],
  "products": [
    {
      "id": 1,
      "name": "Notebook Dell Inspiron",
      "price": 4500.00,
      "category": "tecnologia"
    },
    {
      "id": 2,
      "name": "Teclado Mecânico RGB",
      "price": 350.00,
      "category": "perifericos"
    }
  ]
}
```

### Endpoints Gerados Automaticamente

Apenas adicionando esse bloco no arquivo JSON, o Mock Server passará a responder por:

* `GET /products` - Retorna a lista completa de produtos.
* `GET /products/1` - Retorna o produto com `id: 1`.
* `GET /products?category=tecnologia` - Filtra produtos por propriedades.
* `POST /products` - Cria um novo produto no arquivo.
* `DELETE /products/1` - Remove o produto de `id: 1`.

> [!TIP]
> O `json-server` reescreve o arquivo `db.json` ao receber requisições de escrita (`POST`, `PUT`, `DELETE`). Seus testes de carga locais podem criar registros à vontade, pois eles persistirão no banco local!

---

## 3. Abordagem B: Rotas Programáticas Customizadas (`server.js`)

Se a sua API mock precisa de regras de negócio, validações complexas, códigos de status específicos (ex: `400 Bad Request` com corpo customizado), simulação de latência de rede, ou se ela não mapeia diretamente para um modelo CRUD simples, você deve implementá-la programaticamente.

Como o `json-server` utiliza o **Express** internamente, a declaração de rotas é idêntica à sintaxe clássica do Express.

### Regra Crítica de Ordenação

> [!IMPORTANT]
> Todas as rotas customizadas devem ser declaradas **antes** da linha `server.use(router)`.
> 
> O `router` (vinculado ao `db.json`) funciona como um middleware coringa (wildcard). Se você adicionar a sua rota customizada após ele, o router tentará capturar a requisição primeiro e ela poderá falhar com erro 404.

### Passo a Passo

1. Abra o arquivo [data/server.js](file:///mnt/d/Pulse/data/server.js).
2. Localize a área abaixo do `bodyParser` e antes de `server.use(router)`.
3. Escreva o seu endpoint utilizando `server.get`, `server.post`, `server.put`, etc.

#### Exemplo de Código (`data/server.js`)

Vamos criar uma rota `/payments` do tipo `POST` que valida se o número do cartão foi enviado, simula um tempo de processamento de **200ms** (latência controlada para testar o comportamento do teste de carga sob concorrência) e responde com status `201 Created` ou `400 Bad Request`.

```javascript
const jsonServer = require("json-server");
const server = jsonServer.create();
const router = jsonServer.router("data/db.json");
const middlewares = jsonServer.defaults();

server.use(middlewares);
// Habilita o parseador de requisições JSON. req.body estará disponível.
server.use(jsonServer.bodyParser);

// ==========================================
// ROTA CUSTOMIZADA: Processamento de Pagamento
// ==========================================
server.post("/payments", (req, res) => {
    console.log("--- Mock Payment Request Received ---");
    
    const { amount, card_number } = req.body;

    // Validação simples de input
    if (!amount || !card_number) {
        return res.status(400).json({
            error: "MISSING_REQUIRED_FIELDS",
            message: "Os campos 'amount' e 'card_number' são obrigatórios."
        });
    }

    // Simulando uma latência artificial de 200ms para realismo no teste de carga
    setTimeout(() => {
        res.status(201).json({
            status: "APPROVED",
            transaction_id: "tx_" + Math.random().toString(36).substr(2, 9),
            processed_at: new Date().toISOString()
        });
    }, 200);
});

// A autenticação mock já configurada anteriormente
server.post("/authentication", (req, res) => {
    console.log("--- Mock Auth Request Received ---");
    res.json({
        accessToken: "mock-access-token-12345",
        expiresIn: 3600,
    });
});

// O roteador baseado em db.json SEMPRE no final
server.use(router);

server.listen(3333, () => {
    console.log(" JSON Server is running on http://localhost:3333");
});
```

---

## 4. Como Integrar a Nova Rota no Teste de Carga do Pulse

Para testar a nova rota utilizando a arquitetura desacoplada de 5 camadas do Pulse, você precisará criar os arquivos correspondentes na pasta `/src`. 

### 1. Criar o Contrato / Schema (`src/schemas/payment/payment.schema.ts`)
Valida estruturalmente que a resposta JSON possui exatamente as chaves e os tipos esperados.

```typescript
export const paymentSchema = {
    type: "object",
    required: ["status", "transaction_id", "processed_at"],
    properties: {
        status: { type: "string", enum: ["APPROVED", "REJECTED"] },
        transaction_id: { type: "string" },
        processed_at: { type: "string" }
    }
};
```

### 2. Criar a Chamada Atômica / Use-Case (`src/use-cases/payment/processPayment.useCase.ts`)
Implementa o método HTTP do cliente `@pulse/http` e define os SLAs de validação com o `ps.expect`.

```typescript
import { post } from "@pulse/http";
import { ps } from "@pulse/core";
import { paymentSchema } from "@src/schemas/payment/payment.schema";

export interface PaymentParams {
    baseUrl: string;
    token: string;
    amount: number;
    cardNumber: string;
}

export function processPayment({ baseUrl, token, amount, cardNumber }: PaymentParams) {
    const url = `${baseUrl}/payments`;
    
    const payload = JSON.stringify({
        amount: amount,
        card_number: cardNumber
    });

    // Realiza a chamada HTTP POST injetando o Token Bearer
    const res = post(url, payload, { token }, 201, "ProcessPayment");

    // Valida os acordos de nível de serviço (SLA) funcionais e contratuais
    ps.expect(res)
        .status(201)
        .bodyNotEmpty()
        .responseTimeLessThan(500) // SLA: Resposta em menos de 500ms
        .jsonSchema(paymentSchema);

    return res;
}
```

### 3. Orquestrar a Ação / Flow (`src/flows/payment/payment.flow.ts`)
Associa múltiplos Use Cases em um fluxo lógico e adiciona telemetria com agrupamento transacional (`ps.group`) e tempo de espera realista (`ps.sleep`).

```typescript
import { ps } from "@pulse/core";
import { processPayment } from "@src/use-cases/payment/processPayment.useCase";

export interface FlowParams {
    baseUrl: string;
    token: string;
}

export function paymentFlow({ baseUrl, token }: FlowParams): void {
    ps.group("Transação de Pagamento", () => {
        // Dispara o pagamento simulado utilizando dados realistas
        processPayment({
            baseUrl,
            token,
            amount: 150.50,
            cardNumber: "4532111199998888"
        });

        // Pacing de 1 segundo de tempo para o usuário pensar
        ps.sleep(1);
    });
}
```

### 4. Criar o Cenário de Entrada / Scenario (`src/scenarios/payment/payment.scenario.ts`)
Funciona como o ponto de entrada principal reconhecido pelo compilador do K6. Resolve as variáveis de ambiente, obtém as credenciais e executa o Fluxo.

```typescript
import { Env } from "@pulse/config";
import { paymentFlow } from "@src/flows/payment/payment.flow";

export function setupPayment(): { baseUrl: string; token: string; } {
    const envSuffix = (Env.ENV || "dev").toUpperCase();
    const baseUrl = Env[`BASE_URL_${envSuffix}`] || Env.BASE_URL || "http://localhost:3333";
    const token = Env[`TOKEN_${envSuffix}`] || Env.TOKEN || "no-token";

    return { baseUrl, token };
}

export function paymentScenario(data: { baseUrl: string; token: string; }): void {
    paymentFlow({
        baseUrl: data.baseUrl,
        token: data.token
    });
}
```

---

## 5. Executando e Testando Tudo Junto

1. Certifique-se de que o Mock Server está rodando:
   ```bash
   pulse mock
   ```
2. Configure seu ambiente em `.env` apontando a `BASE_URL` do ambiente `dev` para o mock local:
   ```properties
   BASE_URL_DEV=http://localhost:3333
   ```
3. Execute o seu script apontando para o ambiente `dev`:
   ```bash
   pulse run payment dev
   ```

Se tudo estiver correto, as requisições serão processadas localmente e você verá a latência simulada de **200ms** sendo medida no console do K6 e no Cockpit Dashboard do Pulse!
