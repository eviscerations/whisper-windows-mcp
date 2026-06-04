# Arquitetura de Privacidade — whisper-windows-mcp

Este documento descreve quais dados permanecem na sua máquina, quais dados saem dela e como configurar a ferramenta para conteúdo regulamentado ou sensível.

---

## A garantia central

O whisper-windows-mcp é construído sobre uma arquitetura que prioriza o local. **Arquivos de áudio e vídeo nunca saem da sua máquina.** A transcrição é executada inteiramente no seu hardware usando o whisper.cpp — nenhum serviço de nuvem, conexão com a internet ou chamada de API está envolvida na própria transcrição.

Essa garantia é incondicional para arquivos de mídia.

---

## Dados que sempre permanecem locais

| Dados | Sai da máquina? |
|---|---|
| Arquivos de áudio | ❌ Nunca |
| Arquivos de vídeo | ❌ Nunca |
| Arquivos de modelo Whisper | ❌ Nunca |
| Arquivos WAV de conversão temporária | ❌ Nunca (excluídos após a transcrição) |
| Arquivos de estado do lote e de tarefas | ❌ Nunca |
| Arquivos de transcrição `.txt` / `.srt` / `.vtt` em disco | ❌ Nunca |

---

## Dados que podem sair da máquina (modo padrão)

Quando uma resposta de ferramenta inclui texto de transcrição, esse texto é retornado ao Claude Desktop e processado pela API da Anthropic. Este é o comportamento padrão do MCP — o texto viaja do servidor MCP local para o modelo do Claude pela rede.

| Dados | Sai da máquina? |
|---|---|
| Texto de transcrição retornado inline nas respostas das ferramentas | ✅ Sim, no modo padrão |
| Texto de transcrição enviado diretamente ao Claude como arquivo | ✅ Sim (fora do MCP — nenhum controle de privacidade se aplica) |

Essa lacuna existe entre a garantia da ferramenta de "nenhum dado sai da sua máquina" e o comportamento real quando você pede ao Claude para ler, resumir ou analisar uma transcrição. A maioria dos usuários — aqueles que transcrevem conteúdo público como vídeos do YouTube, podcasts ou gravações de streaming — não é afetada por essa distinção.

Para usuários que lidam com gravações privadas, confidenciais ou regulamentadas, essa distinção é importante.

---

## Modo de Privacidade

`WHISPER_PRIVACY_MODE` restringe todas as respostas das ferramentas apenas a metadados. Quando ativado:

- Todas as respostas das ferramentas retornam apenas: nome do arquivo, contagem de palavras, caminho de salvamento, status de conclusão
- Nenhum texto de transcrição é incluído em qualquer resposta de ferramenta
- O Claude não pode ler, analisar ou retransmitir conteúdo de transcrição de nenhuma forma
- As transcrições existem apenas como arquivos locais em disco

Este modo é projetado para implantações jurídicas, médicas, financeiras e corporativas onde o conteúdo de transcrição não deve sair do ambiente local em nenhuma circunstância.

### Ativar globalmente (variável de ambiente)

Defina em `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-large-v3.bin",
        "WHISPER_PRIVACY_MODE": "true"
      }
    }
  }
}
```

Requer reinicialização do Claude Desktop para ter efeito.

### Ativar por chamada (sem reinicialização)

Passe `privacy_mode=true` diretamente para qualquer ferramenta de transcrição:

- *"Transcreva este arquivo no modo de privacidade"*
- *"Inicie um lote nesta pasta, privacy_mode=true"*
- *"Verifique o progresso do job_123, privacy_mode=true"*

O parâmetro por chamada substitui a variável de ambiente global em ambas as direções. Passe `privacy_mode=false` para desativar em uma única chamada mesmo quando `WHISPER_PRIVACY_MODE=true` estiver definido globalmente.

### Comportamento da porta do modo de privacidade

Quando o modo de privacidade está ativo, uma confirmação de divulgação é exibida **antes de cada operação**. Isso é intencional — a conformidade regulatória exige consentimento informado antes de cada evento de processamento, não apenas uma vez por sessão.

O texto da divulgação é idêntico a cada vez por design. A repetição é o ponto: se você está lidando com conteúdo sensível, você deve confirmar explicitamente cada operação.

Para `start_batch` com modo de privacidade: uma confirmação é necessária antes de o lote começar. Todos os arquivos são então processados sem supervisão. Nenhum texto de transcrição é retornado em nenhum momento — apenas metadados de progresso do lote.

---

## Porta de consentimento (modo padrão)

Quando o modo de privacidade não está ativo, uma divulgação única por sessão é exibida antes que o texto de transcrição seja retornado à API do Claude pela primeira vez em uma sessão.

A divulgação cobre:
- Que o texto de transcrição será transmitido à API da Anthropic
- Os frameworks regulatórios que podem se aplicar ao seu conteúdo
- Como ativar o modo de privacidade se necessário
- Como suprimir permanentemente a porta para conteúdo não sensível

Após você confirmar, a porta não é ativada novamente pelo resto da sessão. Reiniciar o Claude Desktop redefine a sessão e a porta é ativada novamente na próxima chamada que retorne transcrição.

**Para tarefas em segundo plano:** A porta de consentimento é ativada na conclusão de `check_progress`, não no momento da chamada de `transcribe_audio`. No momento da chamada, ainda não existe texto de transcrição — a porta é ativada no momento em que o texto de transcrição seria retornado à API pela primeira vez.

### Suprimir a porta permanentemente

Se você transcreve regularmente conteúdo não sensível e não precisa mais do lembrete, defina na sua configuração:

```json
"WHISPER_CONSENT_ACKNOWLEDGED": "true"
```

Não tem efeito quando o modo de privacidade está ativo. O modo de privacidade usa sua própria porta por operação que sempre é ativada independentemente dessa configuração.

---

## Resumo do fluxo de dados

| Modo | Áudio | Texto de transcrição | Confirmação necessária |
|---|---|---|---|
| Padrão | Somente local | Enviado à API da Anthropic | Uma vez por sessão (porta de consentimento) |
| Modo de privacidade (var. de ambiente) | Somente local | Nunca transmitido | Antes de cada operação |
| Modo de privacidade (por chamada) | Somente local | Não transmitido nesta chamada | Antes desta operação |
| `WHISPER_CONSENT_ACKNOWLEDGED=true` | Somente local | Enviado à API da Anthropic | Nunca (suprimido) |

---

## Upload de arquivos de transcrição diretamente ao Claude

Quando você faz upload de um arquivo de transcrição `.txt` diretamente ao Claude como anexo — completamente fora da ferramenta MCP — o servidor MCP não tem visibilidade e não pode aplicar nenhum controle de privacidade.

Fazer upload de uma transcrição diretamente ao Claude é equivalente a enviar o conteúdo de áudio à Anthropic. O modo de privacidade e todas as proteções no nível do MCP são completamente contornadas por uploads diretos de arquivos.

Usuários que lidam com conteúdo regulamentado não devem fazer upload de transcrições diretamente ao Claude. O único caminho de análise seguro para conteúdo regulamentado são ferramentas de processamento local que não transmitem conteúdo externamente.

---

## Orientação para setores regulamentados

O seguinte é apenas informação geral. Os autores desta ferramenta não são advogados. Os usuários são os únicos responsáveis pela conformidade com as leis e regulamentos aplicáveis. Em caso de dúvida, consulte um advogado qualificado antes de transcrever conteúdo regulamentado.

### HIPAA (EUA — saúde)
Provedores de saúde, seguradoras e seus parceiros de negócios são proibidos de transmitir Informações de Saúde Protegidas (PHI) a terceiros não autorizados sem um Contrato de Associado Comercial (BAA). A Anthropic não oferece HIPAA BAA para uso da API de consumidor do Claude.

**Casos de uso afetados:** Consultas de pacientes, notas clínicas, sessões de terapia, chamadas de sinistros de seguro, gravações administrativas de hospitais.

**Recomendação:** Ative `WHISPER_PRIVACY_MODE=true` antes de transcrever qualquer áudio de pacientes. Não o desative no meio de uma sessão.

### GDPR (UE/EEE)
Dados pessoais de residentes da UE não podem ser transferidos a processadores terceiros sem consentimento explícito e base legal para o processamento. Texto de transcrição contendo nomes, localizações ou qualquer informação de identificação constitui dados pessoais sob o GDPR.

**Casos de uso afetados:** Entrevistas, reuniões, gravações de call center, procedimentos judiciais envolvendo residentes da UE.

**Recomendação:** Ative o modo de privacidade para qualquer gravação que possa conter dados pessoais de residentes da UE/EEE.

### Privilégio Advogado-Cliente (EUA, Reino Unido, Austrália e a maioria das jurisdições de direito comum)
Comunicações entre advogados e clientes são legalmente privilegiadas. A divulgação a terceiros não autorizados pode renunciar ao privilégio. Não existe precedente legal estabelecido que proteja comunicações advogado-cliente quando processadas por APIs de IA comerciais.

**Casos de uso afetados:** Depoimentos jurídicos, consultas com clientes, gravações de estratégia interna, entrevistas com testemunhas.

**Recomendação:** Advogados que transcrevem comunicações privilegiadas devem ativar o modo de privacidade. Não o desative para análise — use editores de texto locais ou ferramentas de processamento para conteúdo privilegiado.

### FERPA (EUA — educação)
Registros educacionais de estudantes são protegidos. Escolas e universidades não podem divulgar informações identificáveis de estudantes a terceiros sem consentimento.

**Casos de uso afetados:** Aulas gravadas, sessões de aconselhamento de estudantes, audiências acadêmicas, reuniões de IEP.

### SOX (EUA — empresas de capital aberto)
Comunicações financeiras de empresas de capital aberto estão sujeitas a requisitos de manutenção de registros e confidencialidade. Informações materiais não públicas (MNPI) não podem ser divulgadas seletivamente.

**Casos de uso afetados:** Gravações de earnings calls, transcrições de reuniões do conselho, comunicações com investidores, discussões de estratégia financeira interna.

### PCI-DSS
Dados de cartão de pagamento não podem ser armazenados ou transmitidos em ambientes não seguros. Gravações de voz de números de cartão durante transações estão no escopo.

**Casos de uso afetados:** Gravações de call center, chamadas de atendimento ao cliente envolvendo processamento de pagamento.

### Proteções de Segredo Comercial / NDA
Informações comerciais confidenciais, fórmulas proprietárias, detalhes de produtos não lançados e informações de pessoal podem ser protegidos por contrato ou lei.

**Casos de uso afetados:** Reuniões de estratégia corporativa, discussões de P&D, chamadas de due diligence de M&A, procedimentos de RH.

---

## Relatando preocupações de privacidade

Se você identificar um problema de privacidade ou uma lacuna arquitetural não coberta aqui, use o relatório privado de vulnerabilidade do GitHub em vez de abrir uma issue pública. Veja [SECURITY.md](SECURITY.md) para instruções de relatório.
