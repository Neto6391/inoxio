import { Link } from "../../app/rotas";
import { Documento, Lista, P, type PropsDoDocumento } from "./Documento";

export function Termos({ dentroDoApp, naJanela }: PropsDoDocumento) {
  return (
    <Documento
      dentroDoApp={dentroDoApp}
      naJanela={naJanela}
      titulo="Termos de Uso"
      secoes={[
        {
          titulo: "1. Aceite",
          corpo: (
            <P>
              Ao criar uma conta ou usar o Inóxio, você concorda com estes Termos e com a{" "}
              <Link para="/privacidade">Política de Privacidade</Link>. Se não concordar, não use o
              serviço.
            </P>
          ),
        },
        {
          titulo: "2. O serviço",
          corpo: (
            <P>
              O Inóxio consulta fontes públicas de reputação (VirusTotal e AbuseIPDB) sobre um
              endereço de página, domínio, IP ou hash de arquivo, calcula um veredito por regras
              fixas e usa IA para explicar o resultado. O resultado é informativo: um veredito
              &quot;sem evidência&quot; não garante que o indicador seja inofensivo, só que as
              fontes não acharam nada. A IA explica, não decide.
            </P>
          ),
        },
        {
          titulo: "3. Sua conta",
          corpo: (
            <Lista
              itens={[
                "A conta é pessoal: não compartilhe a senha.",
                "Você responde pelo que for feito com a sua conta.",
                "Informe um e-mail que seja seu: ele é usado para ativar a conta.",
              ]}
            />
          ),
        },
        {
          titulo: "4. Uso permitido",
          corpo: (
            <>
              <P>Você concorda em não:</P>
              <Lista
                itens={[
                  "usar o serviço para planejar ou apoiar ataques, fraude ou qualquer atividade ilegal;",
                  "tentar contornar limites de uso, de login ou de acesso;",
                  "automatizar consultas além das cotas da sua conta;",
                  "enviar dados pessoais de terceiros sem necessidade, por exemplo em parâmetros de URL;",
                  "atacar, sobrecarregar ou testar a segurança do sistema sem autorização por escrito.",
                ]}
              />
            </>
          ),
        },
        {
          titulo: "5. Limites e cotas",
          corpo: (
            <P>
              Cada conta tem limites de investigações por hora e por dia, que o administrador pode
              ajustar. Os limites existem para proteger o serviço e as cotas das fontes de terceiros.
            </P>
          ),
        },
        {
          titulo: "6. Serviços de terceiros",
          corpo: (
            <P>
              As consultas dependem de VirusTotal, AbuseIPDB e Groq, que têm termos próprios.
              Quando um deles fica fora do ar, o resultado sai inconclusivo. Na versão atual, o
              serviço usa planos gratuitos dessas fontes e não é oferecido comercialmente.
            </P>
          ),
        },
        {
          titulo: "7. Disponibilidade",
          corpo: (
            <P>
              O Inóxio é oferecido no estado em que se encontra, sem garantia de disponibilidade
              contínua. Podemos alterar, suspender ou encerrar funcionalidades.
            </P>
          ),
        },
        {
          titulo: "8. Suspensão e exclusão",
          corpo: (
            <P>
              Contas que violarem estes Termos podem ser desativadas. Você pode excluir a sua conta a
              qualquer momento, na página Minha conta.
            </P>
          ),
        },
        {
          titulo: "9. Responsabilidade",
          corpo: (
            <P>
              As decisões tomadas a partir de um resultado do Inóxio são de quem as toma. Na medida
              permitida pela lei, não respondemos por danos indiretos decorrentes do uso do serviço.
            </P>
          ),
        },
        {
          titulo: "10. Mudanças e lei aplicável",
          corpo: (
            <P>
              Quando estes Termos mudarem, a versão no topo muda e pediremos o seu aceite de novo.
              Estes Termos seguem a lei brasileira.
            </P>
          ),
        },
      ]}
    />
  );
}
