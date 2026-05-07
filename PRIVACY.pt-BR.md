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
| Arquivos de transcrição `.txt` / `.srt` em disco | ❌ Nunca |

---

## Dados que podem sair da máquina (comportamento padrão)

Quando uma resposta de ferramenta inclui texto de transcrição, esse texto é retornado ao Claude Desktop e processado pela API da Anthropic. Este é o comportamento padrão do MCP — o texto viaja do servidor MCP local para o modelo do Claude pela rede.

| Dados | Sai da máquina? |
|---|---|
| Texto de transcrição retornado inline nas respostas das ferramentas | ✅ Sim, por padrão |
| Texto de transcrição enviado diretamente ao Claude como arquivo | ✅ Sim (fora do MCP) |

Essa lacuna existe entre a garantia da ferramenta de "nenhum dado sai da sua máquina" e o comportamento real quando você pede ao Claude para ler, resumir ou analisar uma transcrição. A maioria dos usuários — aqueles que transcrevem conteúdo público como vídeos do YouTube, podcasts ou gravações de streaming — não é afetada por essa distinção.

Para usuários que lidam com gravações privadas, confidenciais ou regulamentadas, essa distinção é importante.

---

## Modo de Privacidade (planejado — ainda não implementado)

Uma variável de ambiente `WHISPER_PRIVACY_MODE` está planejada para um release futuro. Quando ativada:

- Todas as respostas das ferramentas retornam apenas metadados: nome do arquivo, duração, contagem de palavras, status de conclusão
- Nenhum texto de transcrição é incluído em qualquer resposta de ferramenta
- O Claude não pode ler, analisar ou retransmitir conteúdo de transcrição de nenhuma forma
- As transcrições existem apenas como arquivos `.txt` locais em disco

Este modo é projetado para implantações jurídicas, médicas, financeiras e corporativas onde o conteúdo de transcrição não deve sair do ambiente local em nenhuma circunstância.

**Configuração planejada:**

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

Até que esse recurso seja lançado: se você precisar analisar conteúdo de transcrição sem transmiti-lo à API do Claude, abra o arquivo `.txt` diretamente em um editor de texto local ou ferramenta de processamento.

---

## Orientação para setores regulamentados

O seguinte é apenas informação geral. Os autores desta ferramenta não são advogados. Os usuários são os únicos responsáveis pela conformidade com as leis e regulamentos aplicáveis. Em caso de dúvida, consulte um advogado qualificado antes de transcrever conteúdo regulamentado.

### HIPAA (EUA — saúde)
Provedores de saúde, seguradoras e seus parceiros de negócios são proibidos de transmitir Informações de Saúde Protegidas (PHI) a terceiros não autorizados sem um Contrato de Associado Comercial (BAA). A Anthropic não oferece HIPAA BAA para uso da API de consumidor do Claude.

**Casos de uso afetados:** Consultas de pacientes, notas clínicas, sessões de terapia, chamadas de sinistros de seguro, gravações administrativas de hospitais.

**Recomendação atual:** Não transcreva áudio de pacientes e depois peça ao Claude para resumir ou analisar a transcrição, a menos que sua organização tenha estabelecido um arranjo de processamento compatível. Use `WHISPER_PRIVACY_MODE` quando disponível.

### GDPR (UE/EEE)
Dados pessoais de residentes da UE não podem ser transferidos a processadores terceiros sem consentimento explícito e base legal para o processamento. Texto de transcrição contendo nomes, localizações ou qualquer informação de identificação constitui dados pessoais sob o GDPR.

**Casos de uso afetados:** Entrevistas, reuniões, gravações de call center, procedimentos judiciais envolvendo residentes da UE.

**Recomendação atual:** Esteja ciente de que carregar transcrições contendo dados pessoais de residentes da UE ao Claude pode ter implicações no GDPR dependendo do seu papel e finalidade de processamento.

### Privilégio Advogado-Cliente (EUA, Reino Unido, Austrália e a maioria das jurisdições de direito comum)
Comunicações entre advogados e clientes são legalmente privilegiadas. A divulgação a terceiros não autorizados pode renunciar ao privilégio. Não existe precedente legal estabelecido que proteja comunicações advogado-cliente quando processadas por APIs de IA comerciais.

**Casos de uso afetados:** Depoimentos jurídicos, consultas com clientes, gravações de estratégia interna, entrevistas com testemunhas.

**Recomendação atual:** Advogados que transcrevem comunicações privilegiadas não devem carregar essas transcrições ao Claude para análise sem revisão jurídica independente das implicações para o privilégio.

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

## Upload de arquivos de transcrição diretamente ao Claude

Quando você faz upload de um arquivo de transcrição `.txt` diretamente ao Claude como anexo — completamente fora da ferramenta MCP — o servidor MCP não tem visibilidade e não pode aplicar nenhum controle de privacidade.

Fazer upload de uma transcrição diretamente ao Claude é equivalente a enviar o conteúdo de áudio à Anthropic. Nenhum modo de privacidade ou proteção futura no nível do MCP se aplica a uploads diretos de arquivos.

Usuários que lidam com conteúdo regulamentado não devem fazer upload de transcrições diretamente ao Claude. O único caminho de análise seguro para conteúdo regulamentado são ferramentas de processamento local que não transmitem conteúdo externamente.

---

## Relatando preocupações de privacidade

Se você identificar um problema de privacidade ou uma lacuna arquitetural não coberta aqui, use o relatório privado de vulnerabilidade do GitHub em vez de abrir uma issue pública. Veja [SECURITY.md](SECURITY.md) para instruções de relatório.
