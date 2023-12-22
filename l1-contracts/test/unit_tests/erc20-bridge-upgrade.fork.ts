import { expect } from "chai";
import * as hardhat from "hardhat";

import type { ethers } from "ethers";
import {
  L1ERC20Bridge,
  L1ERC20BridgeTest__factory,
  TransparentUpgradeableProxy,
  TransparentUpgradeableProxy__factory
} from "../../typechain-types";

// TODO: change to the mainet config
const L1_ERC20_BRIDGE = "0x927DdFcc55164a59E0F33918D13a2D559bC10ce7";
const GOVERNOR_ADDRESS = "0x98591957D9741e7E7d58FC253044e0A014A3a323";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isPromiseFailed(promise: Promise<any>): Promise<boolean> {
  let failed = false;
  try {
    await promise;
  } catch {
    failed = true;
  }
  return failed;
}

describe("L1 ERC20 proxy upgrade fork test", function () {
  const allowListOnNewImplementation = "0xdeadbeafdeadbeafdeadbeafdeadbeafdeadbeaf";
  const mailboxOnNewImplementation = "0x1234567890123456789012345678901234567890";

  let governor: ethers.Signer;
  let randomSigner: ethers.Signer;
  let bridgeProxy: TransparentUpgradeableProxy;
  let newBridgeImplementation: L1ERC20Bridge;
  let oldBridgeImplementationAddress: string;

  before(async () => {
    await hardhat.network.provider.request({ method: "hardhat_impersonateAccount", params: [GOVERNOR_ADDRESS] });
    governor = await hardhat.ethers.getSigner(GOVERNOR_ADDRESS);
    await hardhat.network.provider.send("hardhat_setBalance", [GOVERNOR_ADDRESS, "0xfffffffffffffffff"]);

    const signers = await hardhat.ethers.getSigners();
    randomSigner = signers[0];
    bridgeProxy = TransparentUpgradeableProxy__factory.connect(L1_ERC20_BRIDGE, randomSigner);
    oldBridgeImplementationAddress = await bridgeProxy.connect(governor).implementation.staticCall();

    const l1Erc20BridgeFactory = await hardhat.ethers.getContractFactory("L1ERC20BridgeTest");
    const l1Erc20Bridge = await l1Erc20BridgeFactory.deploy(mailboxOnNewImplementation, allowListOnNewImplementation);
    newBridgeImplementation = L1ERC20BridgeTest__factory.connect(await l1Erc20Bridge.getAddress(), l1Erc20Bridge.runner);
  });

  it("should revert on non-existed methods", async () => {
    const bridgeProxyAsNewImplementation = L1ERC20BridgeTest__factory.connect(await bridgeProxy.getAddress(), randomSigner);

    const failedGetAllowList = await isPromiseFailed(bridgeProxyAsNewImplementation.getAllowList());
    expect(failedGetAllowList).to.be.true;

    const failedGetMailbox = await isPromiseFailed(bridgeProxyAsNewImplementation.getZkSyncMailbox());
    expect(failedGetMailbox).to.be.true;
  });

  it("should upgrade", async () => {
    await bridgeProxy.connect(governor).upgradeTo(await newBridgeImplementation.getAddress());
  });

  it("check new functions", async () => {
    const bridgeProxyAsNewImplementation = L1ERC20BridgeTest__factory.connect(await bridgeProxy.getAddress(), randomSigner);

    const allowlist = await bridgeProxyAsNewImplementation.getAllowList();
    expect(allowlist.toLocaleLowerCase()).to.be.eq(allowListOnNewImplementation.toLocaleLowerCase());

    const mailbox = await bridgeProxyAsNewImplementation.getZkSyncMailbox();
    expect(mailbox.toLocaleLowerCase()).to.be.eq(mailboxOnNewImplementation.toLocaleLowerCase());
  });

  it("should upgrade second time", async () => {
    const bridgeAsTransparentProxy = TransparentUpgradeableProxy__factory.connect(await bridgeProxy.getAddress(), governor);
    await bridgeAsTransparentProxy.upgradeTo(oldBridgeImplementationAddress);
  });

  it("should revert on non-existed methods", async () => {
    const bridgeProxyAsNewImplementation = L1ERC20BridgeTest__factory.connect(await bridgeProxy.getAddress(), randomSigner);

    const failedGetAllowList = await isPromiseFailed(bridgeProxyAsNewImplementation.getAllowList());
    expect(failedGetAllowList).to.be.true;

    const failedGetMailbox = await isPromiseFailed(bridgeProxyAsNewImplementation.getZkSyncMailbox());
    expect(failedGetMailbox).to.be.true;
  });
});
