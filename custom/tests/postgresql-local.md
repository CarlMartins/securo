# Executar os testes nativos de PostgreSQL localmente

A v0.19.0 usa PostgreSQL 16 com a imagem `pgvector/pgvector:pg16` na [CI](../../.github/workflows/ci.yml#L20). O [módulo nativo de relatórios](../../backend/tests/test_reports_postgres.py) troca a sessão e a dependência de banco do cliente HTTP de teste. A [fixture](../../backend/tests/conftest.py#L128) cria um esquema novo por teste, cria as tabelas por metadata e remove o esquema ao final. O procedimento dispensa migrations e dados de uma instalação do Securo.

## Execução em ambiente descartável

Requer Bash, Git, `uv` e um Docker ou Podman local. Execute o bloco em um Bash dedicado, a partir da raiz do repositório, para que o contêiner seja encerrado ao fim. O snapshot contém apenas o backend rastreado na tag. O contêiner fica sem volumes de dados preexistentes e publica a porta em loopback, com porta aleatória. Os valores `securo_test` são credenciais fictícias para esse contêiner.

```bash
set -euo pipefail
runtime=docker  # Troque por podman se necessário
sandbox=$(mktemp -d)
mkdir "$sandbox/home"

git archive v0.19.0 backend | tar -x -C "$sandbox"

container=$("$runtime" run --detach --rm   --publish 127.0.0.1::5432   --env POSTGRES_USER=securo_test   --env POSTGRES_PASSWORD=securo_test   --env POSTGRES_DB=securo_test   docker.io/pgvector/pgvector:pg16)

trap '"$runtime" stop "$container" >/dev/null 2>&1 || true' EXIT

ready=0
for attempt in {1..30}; do
  if "$runtime" exec "$container" pg_isready -h 127.0.0.1 -U securo_test -d securo_test; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  "$runtime" logs "$container"
  exit 1
fi

mapping=$("$runtime" port "$container" 5432/tcp)
port=${mapping##*:}

(
  cd "$sandbox/backend"
  env -i PATH="$PATH" HOME="$sandbox/home" uv sync --locked --all-extras
  env -i PATH="$PATH" HOME="$sandbox/home" TZ=UTC CI=1     DATABASE_URL='sqlite+aiosqlite:///:memory:'     POSTGRES_TEST_URL="postgresql+asyncpg://securo_test:securo_test@127.0.0.1:$port/securo_test"     .venv/bin/python -m pytest -q -rs tests/test_reports_postgres.py
)
```

O resultado esperado para esta execução é que os **12 casos nativos sejam coletados e nenhum seja pulado por falta de banco**. `CI=1` transforma ausência de `POSTGRES_TEST_URL` em falha. O contêiner é encerrado ao sair do Bash. O diretório temporário contém o snapshot e pode ser removido após a inspeção.

O comando valida a suíte oficial. Exportar a URL e executar `test_custom_reports_api.py` não muda o banco dessa suíte, que continua vinculada às fixtures SQLite. Na implementação, reutilize a sessão e o cliente PostgreSQL da suíte nativa para os casos com status, linhas, rateios, moeda, data de referência e respectivas contribuições. Registre os resultados dos dois bancos separadamente.

Este procedimento foi conferido contra a CI e as fixtures. A execução com PostgreSQL ficou pendente neste ambiente. A tentativa com PostgreSQL local foi bloqueada no socket Unix. As verificações de ambiente desta etapa também encontraram acesso negado ao socket do Docker e diretório de runtime do Podman somente leitura.
