# Política de Segurança

## Escopo

O whisper-windows-mcp é uma ferramenta que prioriza o local. Todo o processamento de áudio acontece na sua máquina — nenhum áudio, arquivo de vídeo ou dado pessoal é transmitido para qualquer servidor. A superfície de ataque está limitada a:

- O sistema de arquivos local (caminhos de arquivo passados às ferramentas)
- O binário whisper-cli.exe e suas dependências
- A conexão MCP do Claude Desktop (apenas IPC local)
- Texto de transcrição retornado nas respostas das ferramentas (veja Arquitetura de Privacidade abaixo)

## Arquitetura de Privacidade

**Arquivos de áudio nunca saem da sua máquina.** Essa garantia é incondicional.

**Texto de transcrição pode sair da sua máquina no modo padrão.** Quando uma resposta de ferramenta inclui texto de transcrição, esse texto é processado pela API do Claude. Este é o comportamento padrão do MCP, mas cria uma lacuna entre a filosofia de design "prioridade local" da ferramenta e o fluxo de dados real para usuários que lidam com conteúdo regulamentado ou confidencial.

**O modo de privacidade** (`WHISPER_PRIVACY_MODE=true` ou `privacy_mode=true` por chamada) restringe todas as respostas das ferramentas apenas a metadados — nenhum texto de transcrição retornado à API do Claude. Esta é a configuração correta para implantações médicas, jurídicas, financeiras e corporativas.

**Porta do modo de privacidade:** Quando o modo de privacidade está ativo, uma confirmação de divulgação explícita é exibida antes de cada operação de transcrição. Isso é intencional e não pode ser contornado — a conformidade regulatória exige consentimento informado por operação.

**Porta de consentimento:** No modo padrão, uma divulgação única por sessão é exibida antes que o texto de transcrição seja retornado à API pela primeira vez em uma sessão. Defina `WHISPER_CONSENT_ACKNOWLEDGED=true` na sua configuração para suprimir isso para conteúdo não sensível.

Veja [PRIVACY.md](PRIVACY.md) para a descrição completa da arquitetura de privacidade, orientação sobre frameworks de conformidade (HIPAA, GDPR, privilégio advogado-cliente, FERPA, SOX, PCI-DSS) e instruções de configuração.

## Verificação do binário

Para verificar a integridade do binário `whisper-cli.exe` no release pré-compilado, verifique o hash SHA256 no PowerShell:

```powershell
Get-FileHash "C:\whisper\Release\whisper-cli.exe" -Algorithm SHA256
```

O hash esperado para cada binário de release é publicado na [página de releases](https://github.com/eviscerations/whisper-windows-mcp/releases). Não use um binário cujo hash não corresponda.

## Versões suportadas

Correções de segurança são aplicadas apenas à versão publicada mais recente.

| Versão | Suportada |
|---|---|
| 2.x (mais recente) | ✅ |
| 1.x | ❌ |

## Reportando uma vulnerabilidade

**Não abra uma issue pública para vulnerabilidades de segurança.**

Use o relatório privado de vulnerabilidade do GitHub:
1. Vá para a [aba Security](https://github.com/eviscerations/whisper-windows-mcp/security)
2. Clique em "Report a vulnerability"
3. Descreva o problema com detalhes suficientes para reproduzi-lo

Você receberá uma resposta em até 7 dias. Se a vulnerabilidade for confirmada, uma correção será lançada o mais rápido possível e você será creditado nas notas de release se desejar.

## Decisões de design conhecidas

- **Injeção de caminho de arquivo:** As ferramentas aceitam caminhos absolutos de arquivo do Claude. Isso é por design — a ferramenta é destinada a ser usada com o Claude Desktop pelo proprietário da máquina. Não exponha este servidor MCP a acesso de rede não confiável.
- **Sem sandbox:** O whisper-cli.exe é executado com as mesmas permissões que o Claude Desktop. Isso é padrão para ferramentas MCP locais.
- **Arquivos temporários:** Arquivos WAV intermediários são gravados em `%TEMP%\whisper_tmp_*.wav` e excluídos após a transcrição. Arquivos de estado de tarefas são gravados em `%TEMP%\whisper-mcp-jobs\` e são limpos automaticamente após 7 dias na inicialização do servidor.
- **Conteúdo de transcrição:** O texto de transcrição retornado nas respostas das ferramentas é processado pela API do Claude no modo padrão. Para evitar isso, ative `WHISPER_PRIVACY_MODE=true` ou passe `privacy_mode=true` por chamada. Veja [PRIVACY.md](PRIVACY.md).
- **Injeção de transcrição:** Arquivos de áudio podem conter conteúdo falado que, quando transcrito, se assemelha a instruções. As defesas integradas do Claude lidam com isso. O próprio servidor MCP marca todo o conteúdo de transcrição como dados não confiáveis e nunca o interpreta como instruções.
- **Downloads de modelos são restritos:** A ferramenta `download_model` só faz download de dois namespaces do Hugging Face confiáveis (`ggerganov/whisper.cpp` e `ggml-org`). Redirecionamentos são validados contra uma lista de permissões antes de serem seguidos. URLs arbitrários são rejeitados no nível do código.
- **A troca de modelos é sandboxed:** `switch_model` só aceita arquivos `.bin` dentro do diretório de modelos configurado. Caminhos fora desse diretório são rejeitados independentemente de como são especificados.
