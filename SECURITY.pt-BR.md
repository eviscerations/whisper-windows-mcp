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

**Porta do modo de privacidade:** Quando o modo de privacidade está ativo, uma confirmação de divulgação explícita é exibida antes de cada operação de transcrição, chaveada por operação (ferramenta + argumentos). O servidor impõe o *bloqueio* — ele retém a operação e retorna a divulgação na primeira vez que vê uma dada operação. Ele **não** garante que um humano respondeu: a barreira é liberada quando a chamada idêntica é reenviada, partindo da premissa de que o host exibiu a divulgação e o usuário respondeu "sim". Um cliente que reenvia a mesma chamada sem um humano no processo pode satisfazer a barreira por conta própria. Trate-a como um controle procedimental de consentimento informado que depende de o host MCP honrar a divulgação, não como uma barreira criptográfica.

**Porta de consentimento:** No modo padrão, uma divulgação única por sessão é exibida antes que o texto de transcrição seja retornado à API pela primeira vez em uma sessão. Defina `WHISPER_CONSENT_ACKNOWLEDGED=true` na sua configuração para suprimir isso para conteúdo não sensível. Observe que esta é uma barreira *única por sessão*: após a primeira transcrição confirmada, transcrições subsequentes na mesma sessão são retornadas sem novo aviso. Use o modo de privacidade para conteúdo que nunca deve chegar à API, independentemente do estado da sessão.

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

## Sandbox e aprovações

whisper-windows-mcp é uma **ferramenta local, de usuário único, controlada pelo proprietário da máquina por meio do Claude Desktop.** Seu modelo de ameaças é o proprietário executando-a na própria máquina — não uma implantação não confiável, multilocatária ou exposta à rede.

- **Sandbox:** nenhum, por design. O `whisper-cli.exe` é executado no nível de permissão do próprio proprietário, igual a qualquer servidor MCP local. O isolamento em nível de SO não é a mitigação aqui; o escopo de uso é — **não exponha este servidor a acesso de rede não confiável** (veja "Injeção de caminho de arquivo" abaixo).
- **As aprovações são em camadas, não baseadas em sandbox:**
  1. **Aprovação do host** — a camada MCP do Claude Desktop controla a invocação de ferramentas.
  2. **Barreiras de consentimento / privacidade** — uma confirmação explícita é necessária antes que qualquer texto de transcrição saia da máquina para a API do Claude; `WHISPER_PRIVACY_MODE` / `privacy_mode` por chamada retorna apenas metadados para conteúdo regulamentado. A barreira é chaveada por operação (ferramenta + argumentos). Veja [PRIVACY.md](PRIVACY.md).
  3. **Validação de entrada** — aplicada de forma defensiva em toda ferramenta que recebe um caminho ou ID:
     - Caminhos de travessia de diretório (`..`) e UNC (`\\server\share`) são rejeitados em **todas** as entradas de arquivo/pasta, incluindo `analyze_media` e `transcribe_batch` (estas duas anteriormente validavam apenas a existência — um caminho UNC não validado poderia induzir uma conexão SMB de saída para um host atacante).
     - `job_id` / `batch_id` são comparados com o formato exato gerado pelo servidor antes de serem usados para construir qualquer caminho do sistema de arquivos, de modo que um ID forjado não possa escapar do diretório de tarefas para leitura/gravação/exclusão arbitrária de arquivos.
     - `switch_model` **e** a substituição `model` de `transcribe_audio` são ambos contidos ao diretório de modelos configurado via contenção de caminho normalizado — a substituição não pode ser usada para entregar um arquivo arbitrário ao `whisper-cli` como seu modelo.
     - Caminhos de `vad_model` rejeitam travessia/UNC.
     - `download_model` é restrito a uma lista de permissões de namespaces confiáveis do Hugging Face (URL inicial e cada redirecionamento).
     - Binários de sistema do Windows invocados implicitamente pelo servidor (`tasklist`, `wmic`) são chamados pelo caminho absoluto em `System32`, de modo que não possam ser mascarados por um executável de mesmo nome plantado antes no `PATH`.

**Uma observação sobre a fronteira do "agente não confiável".** Esta ferramenta foi projetada para um único proprietário controlando-a por meio do Claude Desktop, não como infraestrutura compartilhada ou exposta à rede. No entanto, o conteúdo de áudio/vídeo transcrito é, ele próprio, entrada não confiável que pode *se assemelhar a instruções* e influenciar quais ferramentas são chamadas em seguida e com quais argumentos (veja "Injeção de transcrição" abaixo). Por causa disso, a validação de entrada acima é aplicada de forma defensiva em vez de depender apenas da premissa de usuário único. Uma postura totalmente de agente não confiável ou multilocatária ainda exigiria sandbox de SO/contêiner e uma política de egresso — fora do escopo de uma ferramenta de transcrição local de usuário único.

## Decisões de design conhecidas

- **Injeção de caminho de arquivo:** As ferramentas aceitam caminhos absolutos de arquivo do Claude. Isso é por design — a ferramenta é destinada a ser usada com o Claude Desktop pelo proprietário da máquina. Travessia (`..`) e caminhos UNC são rejeitados em todas as ferramentas que recebem caminhos; caminhos locais absolutos são de resto aceitos. Não exponha este servidor MCP a acesso de rede não confiável.
- **Validação de ID de tarefa/lote:** `job_id` e `batch_id` devem corresponder ao formato exato gerado pelo servidor (`job_<epochMs>_<8 hex>` / `batch_<epochMs>_<8 hex>`) antes de serem usados para construir qualquer caminho do sistema de arquivos. Isso impede que um ID forjado escape do diretório de tarefas para leitura, gravação ou exclusão arbitrária de arquivos por meio do tratamento de conclusão de tarefas.
- **As barreiras de consentimento/privacidade são procedimentais:** As barreiras dependem de o host MCP exibir a divulgação e de um humano responder antes que a operação seja reenviada. O servidor impõe o comportamento de bloqueio-até-reenvio, mas não pode verificar se um humano respondeu. Para conteúdo que nunca deve chegar à API, confie no modo de privacidade (respostas apenas com metadados), não apenas na barreira.
- **Sem sandbox:** O whisper-cli.exe é executado com as mesmas permissões que o Claude Desktop. Isso é padrão para ferramentas MCP locais.
- **Arquivos temporários:** Arquivos WAV intermediários são gravados em `%TEMP%\whisper_tmp_*.wav` e excluídos após a transcrição. Arquivos de estado de tarefas são gravados em `%TEMP%\whisper-mcp-jobs\` e são limpos automaticamente após 7 dias na inicialização do servidor.
- **Conteúdo de transcrição:** O texto de transcrição retornado nas respostas das ferramentas é processado pela API do Claude no modo padrão. Para evitar isso, ative `WHISPER_PRIVACY_MODE=true` ou passe `privacy_mode=true` por chamada. Veja [PRIVACY.md](PRIVACY.md).
- **Injeção de transcrição:** Arquivos de áudio podem conter conteúdo falado que, quando transcrito, se assemelha a instruções. As defesas integradas do Claude lidam com isso. O próprio servidor MCP marca todo o conteúdo de transcrição como dados não confiáveis e nunca o interpreta como instruções.
- **Downloads de modelos são restritos:** A ferramenta `download_model` só faz download de dois namespaces do Hugging Face confiáveis (`ggerganov/whisper.cpp` e `ggml-org`). Redirecionamentos são validados contra uma lista de permissões antes de serem seguidos. URLs arbitrários são rejeitados no nível do código. Downloads truncados/incompletos são rejeitados (verificação de Content-Length) antes de um arquivo `.part` ser promovido ao nome do modelo. **Acompanhamento:** os downloads ainda não são verificados contra um digest SHA256 por modelo, portanto um upstream comprometido ou um atacante no caminho ainda poderia servir um `.bin` malicioso. Digests fixados estão planejados; verifique os hashes manualmente contra a página de releases para implantações de alta garantia.
- **Contenção da seleção de modelos:** Tanto `switch_model` quanto a substituição `model` de `transcribe_audio` só aceitam arquivos `.bin` dentro do diretório de modelos configurado. Caminhos fora dele são rejeitados via contenção de caminho normalizada — um diretório com prefixo-irmão como `…\models-evil` não pode satisfazer a verificação — independentemente de como o caminho é especificado. Caminhos de `vad_model` rejeitam travessia/UNC.
- **Binários de sistema implícitos:** `tasklist` e `wmic` são invocados pelo caminho absoluto em `System32`, não pelo nome simples, de modo que não possam ser mascarados por um executável de mesmo nome plantado antes no `PATH`.
- **Servidor de modelo persistente:** a ferramenta opcional `whisper_server` executa o `whisper-server` do whisper.cpp como um processo residente. Ela é vinculada apenas a `127.0.0.1` — nunca a uma interface roteável — de modo que não seja alcançável fora da máquina. É iniciada e parada explicitamente (nunca iniciada automaticamente), e o processo próprio é encerrado no desligamento. Como um servidor residente e um `whisper-cli` de uma passagem disputariam a mesma GPU/VRAM, os dois são mutuamente exclusivos: uma barreira rígida no caminho de criação de processo desanexado impede que qualquer tarefa de CLI seja iniciada enquanto o servidor está ativo, e as ferramentas de transcrição recusam operações que precisariam da CLI até o servidor ser parado. `WHISPER_SERVER_PORT` seleciona a porta de localhost; o host não é configurável por design.
