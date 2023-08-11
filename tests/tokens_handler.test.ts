import "reflect-metadata";
import {assert, expect} from "chai";
import {TokensHandler} from "../service/handlers/tokens";
import {ServiceSettings} from "../service/settings";

interface IFoo {
  a: string;
  b: number;
  c: boolean;
}

class Foo implements IFoo {
  a: string;
  b: number;
  c: boolean;

  constructor(a?: string, b?: number, c?: boolean) {
    this.a = a || "foo";
    this.b = b || 1349;
    this.c = c || false;
  }
}

class TestServiceSettings extends ServiceSettings {
  constructor(testUrl?: string, testSecret?: string) {
    super(
      testUrl || "https://localhost:8080",
      testSecret || "LOREM_IPSUM_DOLOR_SIT_AMET",
      "TEST_ORG"
    );
  }
}

describe("TokensHandler", () => {
  it("Can create a token from an instance of a class", () => {
    const stateHandler = TokensHandler.withServices(new TestServiceSettings());

    const token: string = stateHandler.createToken(new Foo());
    assert(typeof token === "string");
  });

  it("Can create a token from a plain object", () => {
    const stateHandler = TokensHandler.withServices(new TestServiceSettings());

    const token: string = stateHandler.createToken({foo: "foo"});
    assert(typeof token === "string");
  });

  it("Throws exception for an invalid token", () => {
    const stateHandler = TokensHandler.withServices(new TestServiceSettings());

    const invalidToken =
      `eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpYXQiOjE1ODg5NDkwNzIs
    ImV4cCI6MTU4ODk0OTY3MiwiaXNzIjoiNjI0MjcifQ.H3LLTic7JpvXkFSyFkvb-c3n_znNSglwgTdQxSPWY
    L05O8pmB9Tewj0BGUsgOeFrsWrhVTIqLVtp4f6kFaeqaswnSNHQhm1_RWD760zFOkOZd2_Ha6YrywtRyOOgm
    YWjOr94urW9LbGyoNcykJuspD112YrovVns2NfMXgvd4zpFYdxPpozfEgyU_-PXBQbz_2sxG7fsbD-x9XYKq
    BmHSm_QX7neXJ2kQMwCXMo66pN5B9YQM5Tncx1AtAAKPmFghjHKNTKfWGwhTqHNOgwKSqTEMi7xVB4ZNjia3
    b40E9T4RwMUXswp4KhDn5xAvqGsy83Wb3770X1qx_AEShitZQ`.replace(/[\n\s]/g, "");

    expect(stateHandler.parseToken.bind(stateHandler, invalidToken)).to.throw(
      "Token validation error."
    );
  });

  it("Uses secret from configured settings to create tokens", () => {
    const stateHandler = TokensHandler.withServices(new TestServiceSettings());
    const stateHandler2 = TokensHandler.withServices(
      new TestServiceSettings("", "OTHER_SECRET")
    );

    const input = new Foo();
    const token: string = stateHandler.createToken(input);

    expect(stateHandler2.parseToken.bind(stateHandler2, token)).to.throw(
      "Token validation error."
    );

    const value: IFoo = stateHandler.parseToken(token) as IFoo;

    expect(value.a).to.eq(input.a);
    expect(value.b).to.eq(input.b);
    expect(value.c).to.eq(input.c);
  });
});
