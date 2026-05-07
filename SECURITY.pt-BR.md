# Política de Segurança

## Escopo

O whisper-windows-mcp é uma ferramenta que prioriza o local. Todo o processamento de áudio acontece na sua máquina — nenhum áudio, arquivo de vídeo ou dado pessoal é transmitido para qualquer servidor. A superfície de ataque está limitada a:

- O sistema de arquivos local (caminhos de arquivo passados às ferramentas)
- O binário whisper-cli.exe e suas dependências
- A conexão MCP do Claude Desktop (apenas IPC local)
- Texto de transcrição retornado nas respostas das ferramentas (veja Arquitetura de Privacidade abaixo)

## Arquitetura de Privacidade

**Arquivos de áudio nunca saem da sua máquina.** Essa garantia é incondicional.

**Texto de transcrição pode sair da sua máquina.** Quando uma resposta de ferramenta inclui texto de transcrição, esse texto é processado pela API do Claude. Este é o comportamento padrão do MCP, mas cria uma lacuna entre a filosofia de design "prioridade local" da ferramenta e o fluxo de dados real para usuários que lidam com conteúdo regulamentado ou confidencial.

Uma variável de ambiente `WHISPER_PRIVACY_MODE` está planejada e restringirá todas as respostas das ferramentas apenas a metadados — nenhum texto de transcrição retornado à API do Claude. Esta é a solução pretendida para implantações médicas, jurídicas, financeiras e corporativas.

Veja [PRIVACY.md](PRIVACY.md) para a descrição completa da arquitetura de privacidade, orientação sobre frameworks de conformidade (HIPAA, GDPR, privilégio advogado-cliente, FERPA, SOX, PCI-DSS) e instruções de configuração.

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
- **Arquivos temporários:** Arquivos WAV intermediários são gravados em `%TEMP%\whisper_tmp_*.wav` e excluídos após a transcrição. Arquivos de estado de tarefas são gravados em `%TEMP%\whisper-mcp-jobs\` e persistem até serem limpos manualmente ou até o recurso de limpeza automática planejado ser lançado.
- **Conteúdo de transcrição:** O texto de transcrição retornado nas respostas das ferramentas é processado pela API do Claude. Isso está documentado e será endereçável via `WHISPER_PRIVACY_MODE` em um release futuro. Veja [PRIVACY.md](PRIVACY.md).
