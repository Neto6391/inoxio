import pytest

from inoxio.agente.classificar import classificar_entrada

MD5 = "d41d8cd98f00b204e9800998ecf8427e"
SHA1 = "da39a3ee5e6b4b0d3255bfef95601890afd80709"
SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [
        ("8.8.8.8", ("ip", "8.8.8.8")),
        ("  1.1.1.1 ", ("ip", "1.1.1.1")),
        ("2001:4860:4860:0:0:0:0:8888", ("ip", "2001:4860:4860::8888")),
        (MD5.upper(), ("hash", MD5)),
        (SHA1, ("hash", SHA1)),
        (SHA256, ("hash", SHA256)),
        ("Exemplo.COM.", ("dominio", "exemplo.com")),
        ("sub.exemplo.com.br", ("dominio", "sub.exemplo.com.br")),
        ("açaí.com.br", ("dominio", "xn--aa-4iaz.com.br")),
    ],
)
def test_entradas_validas(entrada, esperado):
    assert classificar_entrada(entrada) == esperado


@pytest.mark.parametrize(
    "entrada",
    [
        "",
        "   ",
        "10.0.0.1",
        "127.0.0.1",
        "192.168.1.1",
        "100.64.0.1",
        "::1",
        "fe80::1",
        "224.0.0.1",
        MD5[:-1],
        MD5 + "0",
        "g" + MD5[1:],
        "exemplo com",
        "exemplo.com:443",
        "http://exemplo.com",
        "user@exemplo.com",
        "exemplo",
        "exemplo.123",
        "-exemplo.com",
        "a" * 64 + ".com",
        "' OR 1=1--",
        "8.8.8.8; id",
        "auditoria",
    ],
)
def test_entradas_recusadas(entrada):
    assert classificar_entrada(entrada) == ("rejeitado", "")
