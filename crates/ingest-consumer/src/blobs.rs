use anyhow::Result;
use jacquard::{
    api::com_atproto::sync::get_blob::GetBlob, common::types::cid::Cid, deps::bytes::Bytes,
    identity::resolver::IdentityResolver, types::did::Did, xrpc::XrpcExt,
};
use sha2::{Digest, Sha256};

use jacquard::client::BasicClient;

// Multicodec codes for ATProto blob CIDs.
const RAW_CODEC: u64 = 0x55;
const SHA2_256_CODE: u64 = 0x12;

/// Fetch a blob with the given `cid` from the PDS that hosts `did`'s repository.
///
/// # Errors
///
/// Returns an error if:
/// - Either the given `did` or `cid` are invalid
/// - The PDS for the given repository can not be resolved
/// - Fetching the blob from the PDS fails
pub async fn fetch_blob(agent: &BasicClient, did: &str, cid: &str) -> Result<Bytes> {
    let did: Did = did.parse()?;
    let pds = agent.pds_for_did(&did).await?;

    let cid: Cid = cid.parse()?;
    let req = GetBlob { did, cid };
    let res = agent.xrpc(pds.borrow()).send(&req).await?;

    let blob = res.into_output()?;

    Ok(blob.body)
}

/// Check that the blob is the one the CID refers to, so a PDS can't serve
/// different content.
pub fn verify_cid(cid: &str, blob: &[u8]) -> Result<()> {
    let cid = cid.parse::<Cid>()?.to_ipld()?;
    let hash = cid.hash();

    if cid.codec() != RAW_CODEC || hash.code() != SHA2_256_CODE {
        let msg = format!("unsupported blob CID {cid}");
        return Err(anyhow::Error::msg(msg));
    }

    if hash.digest() != &Sha256::digest(blob)[..] {
        let msg = format!("blob does not match CID {cid}");
        return Err(anyhow::Error::msg(msg));
    }

    Ok(())
}
